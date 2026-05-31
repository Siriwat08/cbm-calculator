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
