/**
 * Multi-Trip Calculator
 *
 * Determines how many trips are needed to transport all cargo items
 * for each truck type, then calculates and compares total prices.
 *
 * Algorithm:
 * 1. Check Dimensional Feasibility: Can each item physically fit in this truck?
 *    - If any item is too large, mark truck as canFitDimensionally=false
 * 2. Calculate Required Trips (for dimensionally feasible trucks):
 *    - Use 3D bin packing + weight constraint per trip
 *    - Split items across trips until all are assigned or max trips reached
 * 3. Calculate Total Price & Recommend Badge:
 *    - Total price = price per trip × number of trips
 *    - Recommend the cheapest feasible truck
 */

import { performBinPacking, applyWeightConstraint, canItemFitInTruck } from './bin-packing';
import { truckTypes } from './truck-data';
import { LABOR_COST } from './oil-price-api';
import type { CargoItem, TruckType, BinPackingResult, RateData } from './types';

// ===== Types =====

export interface TripAssignment {
  tripIndex: number;
  truckType: TruckType;
  items: CargoItem[];
  binPackingResult: BinPackingResult;
  pricePerTrip: number | null;
  tripCBM: number;
  tripWeight: number;
}

export interface MultiTripResult {
  truckType: TruckType;
  totalTrips: number;
  trips: TripAssignment[];
  totalPrice: number;
  totalCBM: number;
  totalWeight: number;
  feasible: boolean;
  bestValue: boolean;
  oneRound: boolean; // can fit all items in a single trip
  bestOneRound: boolean; // cheapest among one-round options
  canFitDimensionally: boolean; // false if any item can't physically fit
  dimensionalIssue?: string; // description of which items can't fit
}

// ===== Helper: Calculate price from rate data =====

function calculatePriceFromRateData(
  jobKey: string,
  distance: number,
  oilPrice: number,
  rateData: RateData | null,
  includeLabor: boolean
): number | null {
  if (!rateData) return null;

  const jobData = rateData[jobKey];
  if (!jobData) return null;

  if (isNaN(distance) || distance <= 0) return null;

  // Find oil price range index
  let oilIndex = -1;
  for (let i = 0; i < jobData.oil_ranges.length; i++) {
    const range = jobData.oil_ranges[i];
    if (oilPrice >= range.min && oilPrice <= range.max) {
      oilIndex = i;
      break;
    }
  }
  if (oilIndex === -1) oilIndex = jobData.oil_ranges.length - 1;

  // Find distance range index
  let distIndex = -1;
  if (jobData.data && jobData.data.length > 0) {
    for (let i = 0; i < jobData.data.length; i++) {
      const row = jobData.data[i];
      if (distance >= row.dist_min && distance <= row.dist_max) {
        distIndex = i;
        break;
      }
    }
    if (distIndex === -1) {
      if (distance < jobData.data[0].dist_min) {
        distIndex = 0;
      } else {
        distIndex = jobData.data.length - 1;
      }
    }
  }

  if (distIndex >= 0 && jobData.data[distIndex]?.prices?.[oilIndex] !== undefined) {
    let price = jobData.data[distIndex].prices[oilIndex];
    if (includeLabor) {
      price += LABOR_COST;
    }
    return price;
  }

  return null;
}

// ===== Helper: Calculate CBM for an item =====

function calculateItemCBM(item: CargoItem): number {
  return ((item.width * item.length * item.height) / 1000000) * item.quantity;
}

// ===== Helper: Calculate total weight for items =====

function calculateItemsWeight(items: CargoItem[]): number {
  return items.reduce((sum, item) => sum + item.weight * item.quantity, 0);
}

// ===== Helper: Check if all items can fit dimensionally =====

function checkDimensionalFeasibility(
  items: CargoItem[],
  truck: TruckType
): { canFit: boolean; issues: string[] } {
  const issues: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.width <= 0 || item.length <= 0 || item.height <= 0) continue; // skip invalid items

    if (!canItemFitInTruck(item, truck)) {
      issues.push(
        `รายการ ${i + 1}: ${item.width}×${item.length}×${item.height} ซม. ใหญ่เกิน ${truck.name}`
      );
    }
  }

  return { canFit: issues.length === 0, issues };
}

// ===== Helper: Split cargo items by fitted/unfitted indices =====
// This handles the case where only SOME pieces of a multi-quantity item fit.
// Returns { fittedItems, unfittedItems } as CargoItem arrays with adjusted quantities.

function splitItemsByPackingResult(
  items: CargoItem[],
  packingResult: BinPackingResult
): { fittedItems: CargoItem[]; unfittedItems: CargoItem[] } {
  // Count how many pieces of each cargoIndex were fitted vs unfitted
  const fittedCounts = new Map<number, number>();
  const unfittedCounts = new Map<number, number>();

  for (const packed of packingResult.items) {
    fittedCounts.set(packed.cargoIndex, (fittedCounts.get(packed.cargoIndex) || 0) + 1);
  }
  for (const unfitted of packingResult.unfittedItems) {
    unfittedCounts.set(unfitted.cargoIndex, (unfittedCounts.get(unfitted.cargoIndex) || 0) + 1);
  }

  const fittedItems: CargoItem[] = [];
  const unfittedItems: CargoItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const fitted = fittedCounts.get(i) || 0;
    const unfitted = unfittedCounts.get(i) || 0;

    if (fitted > 0) {
      fittedItems.push({ ...item, quantity: fitted });
    }
    if (unfitted > 0) {
      unfittedItems.push({ ...item, quantity: unfitted });
    }
  }

  return { fittedItems, unfittedItems };
}

// ===== Main function =====

const MAX_TRIPS = 10;

export function calculateMultiTrip(
  cargoItems: CargoItem[],
  distance: number,
  oilPrice: number,
  rateData: RateData | null,
  includeLabor: boolean
): MultiTripResult[] {
  const results: MultiTripResult[] = [];

  // Filter to only valid items (positive dimensions)
  const validItems = cargoItems.filter(
    (item) => item.width > 0 && item.length > 0 && item.height > 0
  );

  if (validItems.length === 0) {
    // No valid items, return empty results for each truck type
    return truckTypes.map((truck) => ({
      truckType: truck,
      totalTrips: 0,
      trips: [],
      totalPrice: 0,
      totalCBM: 0,
      totalWeight: 0,
      feasible: true,
      bestValue: false,
      oneRound: false,
      bestOneRound: false,
      canFitDimensionally: true,
    }));
  }

  for (const truck of truckTypes) {
    // === Step 1: Check Dimensional Feasibility ===
    const dimCheck = checkDimensionalFeasibility(validItems, truck);

    if (!dimCheck.canFit) {
      // Some items can't fit in this truck at all
      const totalCBM = validItems.reduce((sum, item) => sum + calculateItemCBM(item), 0);
      const totalWeight = calculateItemsWeight(validItems);

      results.push({
        truckType: truck,
        totalTrips: 0,
        trips: [],
        totalPrice: 0,
        totalCBM,
        totalWeight,
        feasible: false,
        bestValue: false,
        oneRound: false,
        bestOneRound: false,
        canFitDimensionally: false,
        dimensionalIssue: dimCheck.issues.join(', '),
      });
      continue;
    }

    // === Step 2: Calculate Required Trips (with weight constraint) ===
    const trips: TripAssignment[] = [];
    let remainingItems = [...validItems];
    let feasible = true;

    for (let tripNum = 0; tripNum < MAX_TRIPS && remainingItems.length > 0; tripNum++) {
      // Try to pack all remaining items into this truck (volume-based)
      const rawPackingResult = performBinPacking(remainingItems, truck);

      // Apply weight constraint
      const packingResult = applyWeightConstraint(
        rawPackingResult,
        remainingItems,
        truck.maxWeight
      );

      // Split items based on packing result (handles partial quantities)
      const { fittedItems, unfittedItems } = splitItemsByPackingResult(
        remainingItems,
        packingResult
      );

      // If nothing fits in this trip, the truck type can't handle the remaining items
      if (fittedItems.length === 0) {
        feasible = false;
        break;
      }

      // Calculate price for this trip
      const pricePerTrip = calculatePriceFromRateData(
        truck.jobKey,
        distance,
        oilPrice,
        rateData,
        includeLabor
      );

      // Calculate CBM and weight for this trip's items
      const tripCBM = fittedItems.reduce(
        (sum, item) => sum + calculateItemCBM(item),
        0
      );
      const tripWeight = calculateItemsWeight(fittedItems);

      trips.push({
        tripIndex: tripNum + 1,
        truckType: truck,
        items: fittedItems,
        binPackingResult: packingResult,
        pricePerTrip,
        tripCBM,
        tripWeight,
      });

      remainingItems = unfittedItems;
    }

    // If there are still remaining items after max trips, not feasible
    if (remainingItems.length > 0) {
      feasible = false;
    }

    const totalCBM = validItems.reduce(
      (sum, item) => sum + calculateItemCBM(item),
      0
    );
    const totalWeight = calculateItemsWeight(validItems);
    const totalPrice = trips.reduce(
      (sum, trip) => sum + (trip.pricePerTrip ?? 0),
      0
    );

    results.push({
      truckType: truck,
      totalTrips: trips.length,
      trips,
      totalPrice,
      totalCBM,
      totalWeight,
      feasible,
      bestValue: false, // will be set below
      oneRound: false,
      bestOneRound: false,
      canFitDimensionally: true,
    });
  }

  // Mark oneRound flag
  for (const result of results) {
    result.oneRound = result.feasible && result.totalTrips === 1;
  }

  // === Step 3: Determine best value & recommendation ===
  // Only among trucks that are feasible AND dimensionally capable
  const feasibleResults = results.filter((r) => r.feasible && r.canFitDimensionally);
  if (feasibleResults.length > 0) {
    const minPrice = Math.min(...feasibleResults.map((r) => r.totalPrice));
    // Mark all with the minimum price as best value
    for (const result of results) {
      if (result.feasible && result.canFitDimensionally && result.totalPrice === minPrice) {
        result.bestValue = true;
      }
    }
  }

  // Determine best one-round: cheapest among trucks that can do it in 1 trip
  const oneRoundResults = results.filter((r) => r.oneRound && r.canFitDimensionally);
  if (oneRoundResults.length > 0) {
    const minOneRoundPrice = Math.min(...oneRoundResults.map((r) => r.totalPrice));
    for (const result of results) {
      if (result.oneRound && result.canFitDimensionally && result.totalPrice === minOneRoundPrice) {
        result.bestOneRound = true;
      }
    }
  }

  return results;
}

// ===== Mixed Truck Combinations =====

export interface MixedTruckOption {
  trucks: { truck: TruckType; count: number }[];
  totalPrice: number;
  totalTrips: number;
  feasible: boolean;
  description: string;
}

export function calculateMixedTruckOptions(
  cargoItems: CargoItem[],
  distance: number,
  oilPrice: number,
  rateData: RateData | null,
  includeLabor: boolean
): MixedTruckOption[] {
  const validItems = cargoItems.filter(
    (item) => item.width > 0 && item.length > 0 && item.height > 0
  );

  if (validItems.length === 0) return [];

  // First, get single-type results for each truck
  const singleResults = calculateMultiTrip(cargoItems, distance, oilPrice, rateData, includeLabor);
  const feasibleSingles = singleResults.filter(r => r.feasible && r.canFitDimensionally);

  // Only show mixed options if any truck needs > 1 trip
  const needsMultiTrip = feasibleSingles.some(r => r.totalTrips > 1);
  if (!needsMultiTrip) return [];

  const options: MixedTruckOption[] = [];

  // Try each pair of truck types
  for (let i = 0; i < truckTypes.length; i++) {
    for (let j = 0; j < truckTypes.length; j++) {
      if (i === j) continue;

      const truckA = truckTypes[i]; // "big" truck
      const truckB = truckTypes[j]; // "small" truck

      // Check if both trucks can fit all items dimensionally
      const dimCheckA = checkDimensionalFeasibility(validItems, truckA);
      const dimCheckB = checkDimensionalFeasibility(validItems, truckB);
      if (!dimCheckA.canFit || !dimCheckB.canFit) continue;

      // Find how many trips truckA alone would need
      const resultA = feasibleSingles.find(r => r.truckType.id === truckA.id);
      if (!resultA) continue;

      const maxATrips = resultA.totalTrips;

      // Try using 1 to maxATrips of truck A, then fill remaining with truck B
      for (let aTrips = 1; aTrips < maxATrips; aTrips++) {
        // Simulate: run bin packing for remaining items after aTrips of truck A
        let remainingItems = [...validItems];
        let aActuallyUsed = 0;

        for (let trip = 0; trip < aTrips && remainingItems.length > 0; trip++) {
          const rawResult = performBinPacking(remainingItems, truckA);
          const weightResult = applyWeightConstraint(rawResult, remainingItems, truckA.maxWeight);
          const { fittedItems, unfittedItems } = splitItemsByPackingResult(remainingItems, weightResult);

          if (fittedItems.length === 0) break;
          remainingItems = unfittedItems;
          aActuallyUsed++;
        }

        if (remainingItems.length === 0) {
          // All items fit in truck A trips alone — this is a single-type option, skip
          continue;
        }

        // Now try to fit remaining items in truck B
        const resultB = calculateMultiTrip(
          remainingItems.map(item => ({ ...item, id: item.id || crypto.randomUUID() })),
          distance,
          oilPrice,
          rateData,
          includeLabor
        );
        const truckBResult = resultB.find(r => r.truckType.id === truckB.id);

        if (!truckBResult || !truckBResult.feasible || !truckBResult.canFitDimensionally) continue;

        // Calculate total price
        const priceA = calculatePriceFromRateData(truckA.jobKey, distance, oilPrice, rateData, includeLabor) ?? 0;
        const priceB = calculatePriceFromRateData(truckB.jobKey, distance, oilPrice, rateData, includeLabor) ?? 0;
        const totalPrice = priceA * aActuallyUsed + priceB * truckBResult.totalTrips;

        const bCount = truckBResult.totalTrips;
        const totalTrips = aActuallyUsed + bCount;

        // Build description
        const parts: string[] = [];
        if (aActuallyUsed > 0) parts.push(`${truckA.name} ${aActuallyUsed} คัน`);
        if (bCount > 0) parts.push(`${truckB.name} ${bCount} คัน`);
        const description = parts.join(' + ');

        // Check if this combination is already found (avoid duplicates)
        const existingOption = options.find(
          o => o.description === description
        );
        if (existingOption) {
          if (totalPrice < existingOption.totalPrice) {
            existingOption.totalPrice = totalPrice;
            existingOption.trucks = [
              ...(aActuallyUsed > 0 ? [{ truck: truckA, count: aActuallyUsed }] : []),
              ...(bCount > 0 ? [{ truck: truckB, count: bCount }] : []),
            ];
          }
          continue;
        }

        options.push({
          trucks: [
            ...(aActuallyUsed > 0 ? [{ truck: truckA, count: aActuallyUsed }] : []),
            ...(bCount > 0 ? [{ truck: truckB, count: bCount }] : []),
          ],
          totalPrice,
          totalTrips,
          feasible: true,
          description,
        });
      }
    }
  }

  // Sort by price ascending
  options.sort((a, b) => a.totalPrice - b.totalPrice);

  return options;
}
