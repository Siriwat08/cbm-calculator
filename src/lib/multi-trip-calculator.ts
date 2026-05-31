/**
 * Multi-Trip Calculator
 *
 * Determines how many trips are needed to transport all cargo items
 * for each truck type, then calculates and compares total prices.
 *
 * Algorithm:
 * 1. For each truck type, try to pack all items using performBinPacking
 * 2. Fitted items become trip 1, remaining items go to trip 2, etc.
 * 3. Continue until all items are assigned or max trips reached (10)
 * 4. Calculate price per trip using the rate data
 * 5. Return comparison array for all truck types
 */

import { performBinPacking } from './bin-packing';
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
    }));
  }

  for (const truck of truckTypes) {
    const trips: TripAssignment[] = [];
    let remainingItems = [...validItems];
    let feasible = true;

    for (let tripNum = 0; tripNum < MAX_TRIPS && remainingItems.length > 0; tripNum++) {
      // Try to pack all remaining items into this truck
      const packingResult = performBinPacking(remainingItems, truck);

      // Separate fitted and unfitted items
      const fittedIndices = new Set(packingResult.items.map((p) => p.cargoIndex));
      const fittedItems = remainingItems.filter((_, idx) => fittedIndices.has(idx));
      const unfittedItems = remainingItems.filter((_, idx) => !fittedIndices.has(idx));

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
    });
  }

  // Determine best value: lowest total price among feasible options
  const feasibleResults = results.filter((r) => r.feasible);
  if (feasibleResults.length > 0) {
    const minPrice = Math.min(...feasibleResults.map((r) => r.totalPrice));
    // Mark all with the minimum price as best value
    for (const result of results) {
      if (result.feasible && result.totalPrice === minPrice) {
        result.bestValue = true;
      }
    }
  }

  return results;
}
