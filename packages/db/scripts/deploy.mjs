// Run on each Vercel deploy: applies database migrations and the safe registry seed (chains and
// providers, all created disabled; never users or activity). Skipped when DATABASE_URL isn't set,
// so the site still builds and shows its "not connected" states.
import { execSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL is not set: skipping migrations. Sign-in, communities and history need a database.");
  process.exit(0);
}
execSync("pnpm exec prisma migrate deploy", { stdio: "inherit" });
execSync("pnpm exec prisma db seed", { stdio: "inherit" });
