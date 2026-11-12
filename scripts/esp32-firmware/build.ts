// Writes the ESP32 Labs code reader's firmware from esp32-labs/: frontend/public/esp32/firmware/index.json (every
// environment with its file list) and <env>.json (one environment's files with their text).
//   node scripts/esp32-firmware/build.ts            (or pass another folder laid out like esp32-labs/)
// The output is committed, so building the site only needs it, not PlatformIO. It also writes
// frontend/public/esp32/esp32-labs.zip: the whole firmware folder, which students download to flash a real board.
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { collectFirmware } from "./collect.ts";
import { zip } from "./zip.ts";

const root = process.argv[2] ?? resolve(import.meta.dirname, "../../esp32-labs");
const envs = collectFirmware(resolve(root));
if (envs.length === 0) {
  console.error(`no PlatformIO labs found in ${root}`);
  process.exit(1);
}
const out = resolve(import.meta.dirname, "../../frontend/public/esp32/firmware");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const index = {
  envs: envs.map(({ env, about, files }) => ({
    env,
    about,
    files: files.map(({ path, role, group, lines }) => ({ path, role, group, lines })),
  })),
};
writeFileSync(join(out, "index.json"), JSON.stringify(index));
for (const e of envs) writeFileSync(join(out, `${e.env}.json`), JSON.stringify(e));
console.log(`${envs.length} firmware environments → ${out}`);

// The download: every file of the folder except build output, local caches and secrets.
const SKIP = new Set([".pio", ".venv", "node_modules", ".env", "dist"]);
const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir).sort()) {
    if (SKIP.has(name)) continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs);
    else files.push(abs);
  }
};
const folder = resolve(root);
walk(folder);
const archive = zip(files.map((abs) => ({ name: `esp32-labs/${relative(folder, abs).split(sep).join("/")}`, data: readFileSync(abs) })));
const zipPath = resolve(out, "../esp32-labs.zip");
writeFileSync(zipPath, archive);
console.log(`${files.length} files, ${Math.round(archive.length / 1024)} KB → ${zipPath}`);
