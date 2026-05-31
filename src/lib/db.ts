import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Create a PrismaClient with appropriate adapter.
 *
 * - PostgreSQL URL → uses @prisma/adapter-pg (required by Prisma 7 engine type "client")
 * - No URL or SQLite → returns a bare PrismaClient (will fail at runtime if DB ops are attempted)
 *
 * Uses lazy initialization so the client is only created when actually needed (at runtime),
 * not during Next.js build when DATABASE_URL may not be available.
 */
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''

  if (!connectionString || connectionString.startsWith('file:')) {
    console.warn('[DB] No PostgreSQL URL found — Prisma operations will fail at runtime')
    return new PrismaClient()
  }

  // Dynamically import to avoid build-time errors when pg is not needed
  const { PrismaPg } = require('@prisma/adapter-pg')
  const { Pool } = require('pg')
  const pool = new Pool({ connectionString })
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
