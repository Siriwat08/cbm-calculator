---
Task ID: 1
Agent: Main Agent
Task: Fix oil price history not saving - Edge Config read bug

Work Log:
- Analyzed user's screenshot showing oil price data
- Tested API endpoints - found Edge Config always returning empty data (source: "bangchak-api")
- Created debug endpoint `/api/debug/edge-config` to diagnose
- Discovered root cause: Edge Config `/item/{key}` API returns `{ createdAt, key, value, edgeConfigId, updatedAt }` wrapper object, but `getFromEdgeConfig()` was returning the entire wrapper instead of extracting `.value`
- This caused `normalizeToHistoryArray()` to receive an object without `.price` property → returned empty array every time
- Fixed `getFromEdgeConfig()` in `src/lib/oil-price-api.ts` to extract `.value` from API response wrapper
- Fixed same issue in `migrateLegacyKey()` which reads from Edge Config API directly
- Deployed fix and verified: source is now "edge-config" and history accumulates correctly
- Added yesterday's data manually via POST API to test accumulation - confirmed 2 entries persisted
- Cleaned up debug endpoint after verification

Stage Summary:
- Root cause: Edge Config API response wrapper not being unwrapped in getFromEdgeConfig()
- Fix: Extract `.value` property when the response has the `{ key, value, ... }` wrapper structure
- History will now accumulate correctly day by day via cron job
- Previous days' data was lost due to the bug overwriting history daily
- GitHub commit: 8a20c65 "fix: extract .value from Edge Config API response wrapper"

---
Task ID: 2
Agent: Main Agent
Task: Fix PrismaClient build error on Vercel - "client" engine requires adapter

Work Log:
- Diagnosed build error: Prisma 7 "client" engine requires adapter or accelerateUrl in PrismaClient constructor
- Found prisma/schema.prisma was using sqlite provider instead of postgresql
- Found src/lib/db.ts was creating PrismaClient without adapter
- Installed @prisma/adapter-pg (v7.8.0), pg (v8.21.0), @types/pg
- Upgraded @prisma/client and prisma from ^6.11.1 to ^7.8.0
- Created prisma.config.ts for Prisma 7 datasource URL configuration (required in v7)
- Updated prisma/schema.prisma: provider = "postgresql", removed url from datasource
- Merged remote schema (with QuotationStatus enum, @@index, @@map) with our schema
- Updated src/lib/db.ts to create PrismaPg adapter with pg Pool connection
- Added setup-db API endpoint for remote database health check and seeding
- Added postinstall script: "rm -rf node_modules/.prisma && prisma generate"
- Added build script: "rm -rf node_modules/.prisma && npx prisma generate && next build"
- Resolved git merge conflicts with remote (which had more detailed schema)
- Verified build passes locally: all routes render correctly
- Pushed to GitHub for Vercel auto-deploy

Stage Summary:
- Root cause: Prisma 7 requires adapter for "client" engine type
- Fix: Use @prisma/adapter-pg with pg Pool to connect to Vercel Postgres
- Schema fully updated with all 6 models: Setting, Route, Quotation, QuotationTrip, QuotationItem, QuotationStatus enum
- Build passes locally, pushed for Vercel deployment
