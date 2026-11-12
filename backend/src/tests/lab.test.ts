import { describe, expect, it } from "vitest";
import { checkSources, compile, parseDiagnostics } from "../services/compiler.ts";
import { app, request as supertest } from "./helpers.ts";

const request = supertest(app);

// The compile tests need arduino-cli with the AVR core; set ARDUINO_CLI, ARDUINO_DATA_DIR and ARDUINO_USER_DIR to run them.
const hasCli = Boolean(process.env.ARDUINO_CLI);
const blink = "void setup() { pinMode(13, OUTPUT); }\nvoid loop() { digitalWrite(13, !digitalRead(13)); delay(500); }\n";

describe("lab compiler: source checks", () => {
  it("rejects path includes, computed includes and incbin", () => {
    const errors = checkSources([
      {
        name: "sketch.ino",
        content: ['#include "C:/secret.h"', "#include </etc/passwd>", '#include "../x.h"', "#include FILE", 'asm(".incbin \\"x\\"");', "#include <Servo.h>"].join("\n"),
      },
    ]);
    expect(errors).toHaveLength(5);
    expect(errors.some((e) => e.includes("line 6"))).toBe(false);
  });

  it("needs sketch.ino and safe file names", () => {
    expect(checkSources([{ name: "../main.ino", content: "" }])).toEqual(
      expect.arrayContaining([expect.stringContaining("sketch.ino"), expect.stringContaining("not an allowed file name")]),
    );
  });

  it("reads gcc diagnostics without server paths", () => {
    const d = parseDiagnostics("C:\\tmp\\voltex-sketch-1\\sketch\\sketch.ino:4:9: error: 'x' was not declared in this scope");
    expect(d).toEqual([{ file: "sketch.ino", line: 4, column: 9, severity: "error", message: "'x' was not declared in this scope" }]);
  });
});

describe("POST /api/lab/compile", () => {
  it("returns 400 for a disallowed include before compiling", async () => {
    const res = await request.post("/api/lab/compile").send({ board: "uno", files: [{ name: "sketch.ino", content: '#include "/etc/passwd"\n' }] });
    expect(res.status).toBe(400);
  });

  it("validates the board", async () => {
    const res = await request.post("/api/lab/compile").send({ board: "esp32", files: [{ name: "sketch.ino", content: blink }] });
    expect(res.status).toBe(400);
  });

  it.skipIf(!hasCli)("compiles Blink for the Uno into Intel HEX", async () => {
    const res = await request.post("/api/lab/compile").send({ board: "uno", files: [{ name: "sketch.ino", content: blink }] });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.format).toBe("hex");
    expect(res.body.program).toMatch(/^:10000000/);
    expect(res.body.size.flashMax).toBe(32256);
  }, 120_000);

  it.skipIf(!hasCli)("reports a syntax error with its line number", async () => {
    const res = await request.post("/api/lab/compile").send({ board: "uno", files: [{ name: "sketch.ino", content: "void setup() {\n  int x = ;\n}\nvoid loop() {}\n" }] });
    expect(res.body.ok).toBe(false);
    expect(res.body.diagnostics[0]).toMatchObject({ file: "sketch.ino", line: 2, severity: "error" });
    expect(res.body.log).not.toMatch(/voltex-sketch-|\.voltex-tools/);
  }, 120_000);

  it.skipIf(!hasCli)("stops a compile that runs past the time limit", async () => {
    const r = await compile("uno", [{ name: "sketch.ino", content: `${blink}// timeout ${Date.now()}\n` }], 1);
    expect(r.ok).toBe(false);
    expect(r.log).toContain("longer than");
  });
});
