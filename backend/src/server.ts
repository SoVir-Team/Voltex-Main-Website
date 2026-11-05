import { config } from "./config.ts";
import { createApp } from "./app.ts";
import { prisma } from "./db.ts";
import { autoSeed } from "./services/catalogue.ts";

const app = createApp();

if (config.AUTO_SEED !== "false") {
  await autoSeed().catch((e) => console.error("Starter catalogue seed failed:", e));
}

const server = app.listen(config.PORT, () => {
  console.log(`VOLTEX API listening on http://localhost:${config.PORT}`);
});

const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
