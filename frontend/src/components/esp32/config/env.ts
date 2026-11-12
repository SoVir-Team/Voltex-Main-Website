// The code reader's firmware is static JSON under /public/esp32/firmware, written from esp32-labs/ by
// scripts/esp32-firmware/build.ts.

export const env = {
  /** Base URL of the bundled lab code (firmware/index.json + one JSON per environment). */
  firmwareUrl: "/esp32/firmware/",
  /**
   * The bundled datasheet reader's documents. Not shipped: Espressif's datasheet text stays on Espressif's site, so
   * the Datasheet pages cite the official PDFs (features/reference/docs-map.ts) instead of opening a local reader.
   */
  referenceUrl: null as string | null,
  logLevel: (process.env.NODE_ENV === "production" ? "warn" : "info") as "debug" | "info" | "warn" | "error" | "silent",
  isDev: process.env.NODE_ENV !== "production",
  mode: process.env.NODE_ENV ?? "development",
} as const;

export type LogLevel = typeof env.logLevel;
