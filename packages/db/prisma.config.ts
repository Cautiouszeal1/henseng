import "dotenv/config";
import { defineConfig } from "prisma/config";

// DATABASE_URL is optional here so that `prisma generate` (run on install,
// including on Vercel) works without database access. Migrate and seed
// commands fail with a clear connection error if it is missing.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
