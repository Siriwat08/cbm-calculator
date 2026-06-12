# Feature 3: Auto Distance Lookup with OpenRouteService

## Task ID: feature-3-distance-lookup
## Agent: main-dev

## Summary
Successfully implemented Feature 3 — Auto Distance Lookup with OpenRouteService for the CBM Calculator app.

## Files Created

### Backend / Library
1. **`src/lib/ors-api.ts`** — ORS API wrapper module
   - `geocode(query)` — calls ORS geocoding API, returns top 5 results
   - `getRoute(origin, destination)` — calls ORS directions API, returns distance/duration/bbox

### API Routes
2. **`src/app/api/geocode/route.ts`** — Geocode endpoint (GET /api/geocode?q=...)
3. **`src/app/api/distance/route.ts`** — Distance lookup endpoint (GET /api/distance?origin=...&destination=...)
   - Checks DB first for cached routes (by exact name match)
   - Geocodes both places via ORS if not cached
   - Gets route via ORS directions API
   - Auto-saves to DB with useCount tracking
4. **`src/app/api/routes/route.ts`** — Saved routes CRUD (GET /api/routes, ?favorite=true)
5. **`src/app/api/routes/[id]/route.ts`** — Single route update/delete (PATCH/DELETE)
   - PATCH: toggle favorite, update name
   - DELETE: protected by ADMIN_API_KEY

### Frontend
6. **`src/components/DistanceLookup.tsx`** — Distance lookup UI component
   - AutocompleteInput with debounced (300ms) geocode search
   - Distance/duration results display
   - "ใช้ระยะทางนี้" button to fill price calculator distance
   - "💾 บันทึกเส้นทาง" button to save as favorite
   - Embedded OpenStreetMap iframe
   - Saved routes list with favorite star toggle
7. **`src/app/page.tsx`** — Full CBM Calculator + Price Calculator + Distance Lookup
   - Two tabs: CBM Calculator & Price Calculator
   - Distance Lookup section between Oil Price and Price Calculator
   - Integration: "🗺️ ค้นหาระยะทาง" link next to distance input
   - Route description shown below distance input
   - "ใช้ระยะทางนี้" fills distance + route description

### Database
8. **`prisma/schema.prisma`** — Updated with Route model

### Configuration
9. **`.env.example`** — Updated with ORS_API_KEY field
10. **`.env`** — Added ORS_API_KEY and ADMIN_API_KEY
11. **`src/app/layout.tsx`** — Updated metadata for Thai transport company

## API Test Results
- ✅ GET /api/geocode?q=Bangkok — returns 5 geocoding results
- ✅ GET /api/distance?origin=Bangkok&destination=Chiang%20Mai — returns 675.9 km, 475 min, auto-saved
- ✅ GET /api/distance (cached) — returns same result from DB (10ms vs 1392ms)
- ✅ GET /api/routes — returns saved routes list
- ✅ PATCH /api/routes/[id] — toggles favorite successfully
- ✅ DELETE /api/routes/[id] — protected by ADMIN_API_KEY

## Push to GitHub
- ✅ Committed and pushed to https://github.com/Siriwat08/cbm-calculator

## Vercel Env Var
- ⚠️ ORS_API_KEY needs to be set manually on Vercel (CLI requires login)
  - Command: `echo "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImI0YTRlZGIxNWU1NjEzNmI0MWRiZDAxYzU2MGZiNTA0NTRjZGM0YjEyNTBkMjlhMTgyYzI4OWQ1IiwiaCI6Im11cm11cjY0In0=" | vercel env add ORS_API_KEY production preview development`

## Style Notes
- Blue/indigo gradient for distance section (differentiated from green oil price, slate price calc)
- All UI text in Thai
- Same card style (rounded-xl, shadow-lg, gradient headers)
- Same input styling (border-2 border-gray-300 rounded-lg)
- Responsive design (grid-cols-1 md:grid-cols-2)
