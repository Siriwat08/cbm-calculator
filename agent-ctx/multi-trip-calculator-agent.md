# Task: Build Feature 2 - Multi-Trip Calculator for CBM Calculator App

## Summary
Successfully implemented the Multi-Trip Calculator feature for the CBM Calculator app. This feature allows users to compare transportation costs across all truck types when multiple trips are needed.

## Files Created/Modified

### 1. `/home/z/my-project/src/lib/multi-trip-calculator.ts` (NEW)
- Core logic for multi-trip calculation
- `calculateMultiTrip()` function that:
  - For each truck type, tries to pack all items using `performBinPacking`
  - Splits items into trips when they don't fit in one truck
  - Calculates price per trip using the rate data (matching existing price calculation logic)
  - Continues until all items are assigned or max trips (10) reached
  - Returns comparison array for all truck types with `bestValue` flag for cheapest option
- Helper function `calculatePriceFromRateData()` that matches the existing price logic exactly

### 2. `/home/z/my-project/src/components/MultiTripCalculator.tsx` (NEW)
- UI component showing:
  - Summary card with total items, CBM, and weight
  - Comparison table for ALL truck types with columns: ประเภทรถ, จำนวนเที่ยว, CBMรวม, น้ำหนักรวม, ราคา/เที่ยว, ราคารวม, แนะนำ
  - Expandable detail for each truck showing trip-by-trip breakdown
  - Each trip shows: items, CBM utilization, weight, price, utilization bars
  - Highlights "best value" (cheapest total price that fits all items)
  - Warning if any truck type can't fit all items
  - Thai language UI matching existing app style

### 3. `/home/z/my-project/src/app/page.tsx` (MODIFIED)
- Added `MultiTripCalculator` import
- Extended tab state type to include `'multitrip'`
- Added new tab button: "🚚 Multi-Trip"
- Added new tab content section with:
  - Distance input with link to price tab for distance lookup
  - Oil price display
  - Labor cost toggle
  - MultiTripCalculator component with all required props

## Key Design Decisions
- Used violet/purple gradient for the new tab to differentiate from existing green/slate themes
- Price calculation matches existing logic exactly (oil index + distance index lookup)
- Max trips limited to 10 to prevent infinite loops
- Component handles edge cases: no valid items, no distance set, infeasible trucks
- All text in Thai language matching existing app patterns
