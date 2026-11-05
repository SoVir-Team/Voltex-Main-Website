import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // CI and the server pass DATABASE_URL in the environment; locally it comes from .env.
    url: process.env["DATABASE_URL"] ?? "",
  },
});
