import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { config } from "../config.ts";
import { HttpError } from "../lib/http.ts";

/**
 * Compiles Student Lab sketches with arduino-cli. Only compiling happens here; the program runs in the student's
 * browser on an emulated chip. Sources are checked first so a sketch cannot pull server files into its error
 * messages or its binary (no path or computed #include, no .incbin), every job gets its own temp folder and a
 * time limit, and only a few compiles run at once.
 */

export type CompileBoard = "uno" | "pico";

export const FQBN: Record<CompileBoard, string> = {
  uno: "arduino:avr:uno",
  pico: "rp2040:rp2040:rpipico",
};

export interface SourceFile {
  name: string;
  content: string;
}

export interface Diagnostic {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning" | "note";
  message: string;
}

export interface CompileResult {
  ok: boolean;
  /** Intel HEX text for the Uno, base64 UF2 for the Pico. */
  program?: string;
  format?: "hex" | "uf2";
  /** Flash and RAM use as arduino-cli reports them. */
  size?: { flash: number; flashMax: number; ram: number; ramMax: number };
  diagnostics: Diagnostic[];
  log: string;
}

export const MAX_SOURCE_BYTES = 64 * 1024;
const FILE_NAME = /^[A-Za-z0-9_-]{1,40}\.(ino|h|hpp|c|cpp)$/;
/** A header name: plain path segments, no drive letters, no parent directories, no leading slash. */
const HEADER = /^[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+)*\.(h|hpp|hh)$|^[A-Za-z0-9_]+$/;

/** Problems with the sources, as messages to show the student. Empty when they are fine to compile. */
export function checkSources(files: SourceFile[]): string[] {
  const errors: string[] = [];
  if (!files.some((f) => f.name === "sketch.ino")) errors.push("The project needs a sketch.ino file.");
  const total = files.reduce((n, f) => n + Buffer.byteLength(f.content, "utf8"), 0);
  if (total > MAX_SOURCE_BYTES) errors.push(`The code is ${Math.round(total / 1024)} KB; the limit is ${MAX_SOURCE_BYTES / 1024} KB.`);
  const names = new Set<string>();
  for (const f of files) {
    if (!FILE_NAME.test(f.name)) errors.push(`"${f.name}" is not an allowed file name. Use letters, digits, - or _ and .ino, .h, .c or .cpp.`);
    if (names.has(f.name.toLowerCase())) errors.push(`Two files are called ${f.name}.`);
    names.add(f.name.toLowerCase());
    // Join backslash-continued lines first, as the preprocessor does.
    const lines = f.content.replace(/\\\r?\n/g, "").split(/\r?\n/);
    lines.forEach((line, i) => {
      const at = `${f.name} line ${i + 1}`;
      const inc = /^\s*#\s*(include|include_next|import)\b\s*(.*)$/.exec(line);
      if (inc) {
        const arg = inc[2].replace(/\/\/.*$|\/\*.*?\*\//g, "").trim();
        const m = /^<([^>]+)>$|^"([^"]+)"$/.exec(arg);
        const name = m?.[1] ?? m?.[2];
        if (!name) errors.push(`${at}: #include must name a file in <...> or "...".`);
        else if (!HEADER.test(name)) errors.push(`${at}: #include ${arg} is not allowed. Include library headers by name, like <Servo.h>.`);
      }
      if (/\bincbin\b|\.include\b|__has_include|#\s*pragma\s+GCC\s+(?:system_header|poison)|-include\b/i.test(line)) errors.push(`${at}: this directive is not allowed in the lab.`);
    });
  }
  return errors;
}

// ---------- Concurrency ----------
// Each slot owns a build folder per board that outlives the job: arduino-cli then recompiles only the sketch and
// reuses the compiled core and libraries (minutes for the RP2040 core, seconds for the sketch). Two jobs never
// share a slot, so they never share a folder.
const free: number[] = [];
let slots = 0;
const waiting: ((n: number) => void)[] = [];
const MAX_QUEUE = 20;

async function slot<T>(fn: (n: number) => Promise<T>): Promise<T> {
  let n = free.pop();
  if (n === undefined && slots < config.COMPILE_CONCURRENCY) n = slots++;
  if (n === undefined) {
    if (waiting.length >= MAX_QUEUE) throw new HttpError(503, "The compiler is busy. Try again in a moment.");
    n = await new Promise<number>((r) => waiting.push(r));
  }
  try {
    return await fn(n);
  } finally {
    const next = waiting.shift();
    if (next) next(n);
    else free.push(n);
  }
}

const buildRoot = () => path.join(os.tmpdir(), "voltex-arduino-build");

// ---------- Cache ----------
const cache = new Map<string, CompileResult>();
const CACHE_MAX = 200;

function remember(key: string, r: CompileResult) {
  cache.delete(key);
  cache.set(key, r);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
}

export const compilerAvailable = () => Boolean(config.ARDUINO_CLI);

function run(args: string[], cwd: string, timeoutMs: number): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      TEMP: cwd,
      TMP: cwd,
      TMPDIR: cwd,
      HOME: cwd,
      ARDUINO_DIRECTORIES_DATA: config.ARDUINO_DATA_DIR,
      ARDUINO_DIRECTORIES_USER: config.ARDUINO_USER_DIR,
      ARDUINO_DIRECTORIES_DOWNLOADS: path.join(cwd, "downloads"),
      ARDUINO_BUILD_CACHE_PATH: path.join(os.tmpdir(), "voltex-arduino-cache"),
      ARDUINO_UPDATER_ENABLE_NOTIFICATION: "false",
      ARDUINO_METRICS_ENABLED: "false",
    };
    const child = spawn(config.ARDUINO_CLI!, args, { cwd, env, windowsHide: true });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const cap = (s: string, d: Buffer) => (s.length < 2_000_000 ? s + d.toString("utf8") : s);
    child.stdout.on("data", (d: Buffer) => (stdout = cap(stdout, d)));
    child.stderr.on("data", (d: Buffer) => (stderr = cap(stderr, d)));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

/** Turn gcc output lines into diagnostics, with file names relative to the sketch. */
export function parseDiagnostics(text: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  const re = /^(?:.*[\\/])?([A-Za-z0-9_-]+\.(?:ino|h|hpp|c|cpp)):(\d+):(\d+):\s+(fatal error|error|warning|note):\s+(.*)$/gm;
  for (const m of text.matchAll(re)) {
    out.push({ file: m[1], line: Number(m[2]), column: Number(m[3]), severity: m[4] === "fatal error" ? "error" : (m[4] as Diagnostic["severity"]), message: m[5].trim() });
  }
  return out;
}

export async function compile(board: CompileBoard, files: SourceFile[], timeoutMs = config.COMPILE_TIMEOUT_MS): Promise<CompileResult> {
  if (!compilerAvailable()) throw new HttpError(503, "Compiling is not set up on this server yet.");
  const key = createHash("sha256")
    .update(JSON.stringify([board, [...files].sort((a, b) => a.name.localeCompare(b.name))]))
    .digest("hex");
  const hit = cache.get(key);
  if (hit) return hit;

  return slot(async (n) => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "voltex-sketch-"));
    try {
      const sketch = path.join(dir, "sketch");
      await mkdir(sketch);
      for (const f of files) await writeFile(path.join(sketch, f.name), f.content, "utf8");
      const outDir = path.join(dir, "out");
      const build = path.join(buildRoot(), `${board}-${n}`);
      await mkdir(build, { recursive: true });
      const res = await run(["compile", "--fqbn", FQBN[board], "--output-dir", outDir, "--build-path", build, "--warnings", "default", "--no-color", sketch], dir, timeoutMs);
      // Paths can come back with either slash, so swap out both spellings of each folder.
      const spellings = (p?: string) => (p ? [...new Set([path.resolve(p), path.resolve(p).replace(/\\/g, "/")])] : []);
      const swaps: [string, string][] = [
        ...spellings(sketch).flatMap((p): [string, string][] => [[p + "\\", ""], [p + "/", ""]]),
        ...spellings(dir).map((p): [string, string] => [p, ""]),
        ...spellings(buildRoot()).map((p): [string, string] => [p, "<build>"]),
        ...spellings(config.ARDUINO_DATA_DIR).map((p): [string, string] => [p, "<arduino>"]),
        ...spellings(config.ARDUINO_USER_DIR).map((p): [string, string] => [p, "<libraries>"]),
      ];
      const clean = (s: string) =>
        swaps
          .reduce((t, [from, to]) => t.split(from).join(to), s)
          .replace(/[A-Za-z]:\\[^\s:]*\\(?=[A-Za-z0-9_-]+\.(?:ino|h|c|cpp|S)\b)/g, "")
          .replace(/\/[^\s:]*\/(?=[A-Za-z0-9_-]+\.(?:ino|h|c|cpp|S)\b)/g, "");
      const log = clean(`${res.stdout}\n${res.stderr}`).trim().slice(-20_000);
      if (res.timedOut) return { ok: false, diagnostics: [], log: `Compiling took longer than ${Math.round(timeoutMs / 1000)} s and was stopped.` };
      const diagnostics = parseDiagnostics(log).filter((d) => files.some((f) => f.name === d.file));
      if (res.code !== 0) {
        const result: CompileResult = { ok: false, diagnostics, log };
        remember(key, result);
        return result;
      }
      const flash = /uses (\d+) bytes .* Maximum is (\d+) bytes/.exec(log);
      const ram = /Global variables use (\d+) bytes .* Maximum is (\d+) bytes/.exec(log);
      const size = flash && ram ? { flash: Number(flash[1]), flashMax: Number(flash[2]), ram: Number(ram[1]), ramMax: Number(ram[2]) } : undefined;
      const result: CompileResult =
        board === "uno"
          ? { ok: true, format: "hex", program: await readFile(path.join(outDir, "sketch.ino.hex"), "utf8"), size, diagnostics, log }
          : { ok: true, format: "uf2", program: (await readFile(path.join(outDir, "sketch.ino.uf2"))).toString("base64"), size, diagnostics, log };
      remember(key, result);
      return result;
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });
}

/**
 * Build each board's core once in every compile slot, in the background, so the first student's compile only
 * builds their sketch (a cold RP2040 core takes minutes; a warm compile, seconds).
 */
export async function warmUp(): Promise<void> {
  if (!compilerAvailable()) return;
  for (const board of Object.keys(FQBN) as CompileBoard[]) {
    await Promise.all(
      Array.from({ length: config.COMPILE_CONCURRENCY }, (_, i) =>
        compile(board, [{ name: "sketch.ino", content: `// warm-up ${i}\nvoid setup() {}\nvoid loop() {}\n` }], 30 * 60_000).catch(() => undefined),
      ),
    );
  }
}
