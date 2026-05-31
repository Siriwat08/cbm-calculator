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
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    url: env('DATABASE_URL'),
  },
});
