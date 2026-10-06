// Prisma config. DATABASE_URL must come from the environment (see .env.example).
import "dotenv/config";
import { defineConfig } from "prisma/config";
import { assertDatabaseEnvironment } from "./src/common/database-target";

if (process.env.DATABASE_URL) {
  assertDatabaseEnvironment(process.env);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
