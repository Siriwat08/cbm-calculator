/**
 * Prisma Client Singleton with PostgreSQL Adapter
 *
 * Uses @prisma/adapter-pg to connect Prisma to Vercel Postgres (Neon).
 * Prisma 6+ with "client" engine type requires either an adapter or accelerateUrl.
 *
 * IMPORTANT: This file must work during Next.js build time.
 * If DATABASE_URL is not available (e.g., during static analysis),
 * the pool/adapter creation is deferred until first actual use.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''

  if (!connectionString) {
    console.warn('[DB] No DATABASE_URL or POSTGRES_URL found — Prisma operations will fail at runtime')
    // Return a bare client; it will throw a clear error if actually used
    return new PrismaClient()
  }

  const pool = new pg.Pool({ connectionString })
  const adapter = new PrismaPg(pool)

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

export default db
