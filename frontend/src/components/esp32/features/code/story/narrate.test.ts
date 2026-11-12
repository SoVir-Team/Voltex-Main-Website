import { describe, expect, it } from "vitest";
import { createGlossary } from "@/components/esp32/domain/code/glossary";
import { i18n } from "@/components/esp32/i18n/i18n";
import { buildLabCode } from "../lab-code";
import { narrate } from "./narrate";
import { storyOf } from "./use-story";

const doc = {
  env: "demo",
  about: "A demo.",
  files: [
    {
      path: "src/demo/main.cpp",
      role: "lab" as const,
      group: "demo",
      lines: 8,
      text: `#include "kit.h"\n\nKit kit;\n\nvoid setup() {\n  kit.begin();\n}\n\nvoid loop() {}\n`,
    },
    {
      path: "lib/kit/src/kit.h",
      role: "shared" as const,
      group: "kit",
      lines: 9,
      text: `#pragma once\nclass Kit {\n public:\n  // Wakes the kit up.\n  void begin() {\n    a = 1;\n    b = 2;\n    c = 3;\n  }\n  int a, b, c;\n};\n`,
    },
  ],
};

describe("narrate", () => {
  const lab = buildLabCode(doc, createGlossary([]), undefined, i18n.getFixedT("en", "code"));
  const story = storyOf(lab, "explorer");

  it("opens with the board powering up, then follows the call into the shared file", () => {
    const [setup, begin] = story.scenes;
    const [main, kit] = lab.files;
    if (!setup || !begin || !main || !kit)
      throw new Error("the demo lab should have two scenes and two files");
    expect(narrate(setup, lab, main).title).toBe("Power on: setup()");
    expect(narrate(begin, lab, kit)).toMatchObject({
      title: "Kit::begin()",
      note: "Wakes the kit up.",
    });
    expect(narrate(begin, lab, kit).lead).toBe(
      "<code>setup()</code> calls <code>Kit::begin()</code> on line 6 of <code>main.cpp</code>. That code lives in another file, <code>kit.h</code>, shared by several labs.",
    );
  });
});
