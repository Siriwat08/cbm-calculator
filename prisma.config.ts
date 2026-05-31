/**
 * Prisma 7 Configuration
 *
 * In Prisma 7, database connection URLs are configured here
 * instead of in schema.prisma. This separates connection config
 * from schema definition.
 */

import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  migrate: {
    async url() {
      return env('DATABASE_URL') || process.env.POSTGRES_URL || '';
    },
  },
  datasource: {
    url: env('DATABASE_URL') || process.env.POSTGRES_URL || '',
  },
});
