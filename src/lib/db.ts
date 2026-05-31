/**
 * Prisma Client Singleton with PostgreSQL Adapter
 *
 * Uses @prisma/adapter-pg to connect Prisma to Vercel Postgres (Neon).
 * Prisma 7 with "client" engine type requires an adapter.
 *
 * Uses lazy initialization so the client is only created when actually needed (at runtime),
 * not during Next.js build when DATABASE_URL may not be available.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Create a PrismaClient with appropriate adapter.
 *
 * - PostgreSQL URL → uses @prisma/adapter-pg (required by Prisma 7 engine type "client")
 * - No URL → returns a bare PrismaClient (will fail at runtime if DB ops are attempted)
 */
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''

  if (!connectionString) {
    console.warn('[DB] No DATABASE_URL or POSTGRES_URL found — Prisma operations will fail at runtime')
    return new PrismaClient()
  }

  const pool = new pg.Pool({ connectionString })
  const adapter = new PrismaPg(pool)

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

let _prisma: PrismaClient | undefined;

export function getDb(): PrismaClient {
  if (!_prisma) {
    _prisma = globalForPrisma.prisma ?? createPrismaClient();
    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = _prisma;
  }
  return _prisma;
}

// Default export for convenience (lazy getter)
export default getDb;
