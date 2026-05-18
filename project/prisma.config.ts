import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });
config();

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://user:password@localhost:5432/database";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.mjs",
  },
  datasource: {
    url: databaseUrl,
  },
});
