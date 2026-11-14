import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

export * from "./generated/prisma/client";

const globalForPrisma = globalThis as unknown as { __hensengPrisma?: PrismaClient };

/**
 * Lazily creates one Prisma client per process. Works with Neon (use the pooled
 * connection string) and with the local docker-compose Postgres.
 */
export function getDb(): PrismaClient {
  if (globalForPrisma.__hensengPrisma) return globalForPrisma.__hensengPrisma;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new DatabaseNotConfiguredError();
  }
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  // Cached on globalThis so Next.js hot reload doesn't open a new pool each time.
  globalForPrisma.__hensengPrisma = client;
  return client;
}

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set");
    this.name = "DatabaseNotConfiguredError";
  }
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
