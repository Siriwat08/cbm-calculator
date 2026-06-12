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
 * Creates a PrismaClient-like proxy that returns rejected promises on any DB operation.
 * This prevents the server from crashing when Prisma can't connect to the database.
 * API routes can catch these errors gracefully and return 500 responses.
 */
function createNoopProxy(): PrismaClient {
  const errorMsg = '[DB] Database not available — please check DATABASE_URL configuration'
  
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === '$connect' || prop === '$disconnect' || prop === '$on' || prop === '$use' || prop === '$extends') {
        return () => Promise.resolve()
      }
      if (typeof prop === 'string' && !prop.startsWith('__')) {
        // Return a nested proxy for model access (e.g., db.quotation.findFirst)
        return new Proxy({}, {
          get() {
            // Return an async function that rejects, so API routes can catch it
            return (..._args: unknown[]) => Promise.reject(new Error(errorMsg))
          }
        })
      }
      return undefined
    }
  }

  return new Proxy({}, handler) as unknown as PrismaClient
}

/**
 * Create a PrismaClient with appropriate adapter.
 *
 * - PostgreSQL URL → uses @prisma/adapter-pg (required by Prisma 7 engine type "client")
 * - No URL / Non-PostgreSQL URL → returns a noop proxy that safely rejects DB operations
 */
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''

  if (!connectionString) {
    console.warn('[DB] No DATABASE_URL or POSTGRES_URL found — Prisma operations will fail at runtime')
    return createNoopProxy()
  }

  // Only use PostgreSQL adapter if the URL starts with postgres:// or postgresql://
  if (connectionString.startsWith('postgres://') || connectionString.startsWith('postgresql://')) {
    try {
      const pool = new pg.Pool({ connectionString })
      const adapter = new PrismaPg(pool)

      return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      })
    } catch (error) {
      console.error('[DB] Failed to create PostgreSQL adapter:', error)
      return createNoopProxy()
    }
  }

  // For non-PostgreSQL URLs (e.g., SQLite file://), return a noop proxy
  console.warn('[DB] Non-PostgreSQL connection URL detected — database operations will fail at runtime')
  return createNoopProxy()
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
