import { config } from "./config.ts";
import { createApp } from "./app.ts";
import { prisma } from "./db.ts";
import { autoSeed } from "./services/catalogue.ts";
import { warmUp } from "./services/compiler.ts";

const app = createApp();

if (config.AUTO_SEED !== "false") {
  await autoSeed().catch((e) => console.error("Starter catalogue seed failed:", e));
}

const server = app.listen(config.PORT, () => {
  console.log(`VOLTEX API listening on http://localhost:${config.PORT}`);
});

// Student Lab compiler: build the board cores while nothing is waiting on them.
void warmUp().then(() => config.ARDUINO_CLI && console.log("Student Lab compiler ready"));

const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
