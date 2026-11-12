import type { SectionKind } from "@/components/esp32/domain/lesson-sections";
import type { IconName } from "@/components/esp32/ui/Icon";

/** One icon per kind of section, the same in the page and in the section nav. */
export const SECTION_ICON: Record<SectionKind | "board", IconName> = {
  goal: "flag",
  explain: "bulb",
  wiring: "wire",
  commands: "terminal",
  steps: "steps",
  preview: "scope",
  board: "board",
};
