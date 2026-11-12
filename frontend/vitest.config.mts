import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The ESP32 Labs tests run on vitest; the rest of the frontend uses node --test.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/components/esp32/**/*.test.{ts,tsx}"], environment: "node" },
});
