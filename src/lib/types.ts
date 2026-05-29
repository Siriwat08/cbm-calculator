// ===== Core Types =====

export interface OilPrice {
  date: string; // ISO format: YYYY-MM-DD for storage
  price: number;
  manual?: boolean;
}

export interface OilRange {
  min: number;
  max: number;
}

export interface DistanceRate {
  dist_min: number;
  dist_max: number;
  prices: number[];
}

export interface RateData {
  [key: string]: {
    oil_ranges: OilRange[];
    data: DistanceRate[];
  };
}

export interface TruckType {
  id: string;
  name: string;
  image: string;
  cbm: number;
  maxWeight: number;
  dimensions: { width: number; length: number; height: number };
  usableSpace: number;
  jobKey: string;
}

export interface CargoItem {
  id: string;
  width: number;
  length: number;
  height: number;
  quantity: number;
  weight: number;
}

// ===== 3D Bin Packing Types =====

export interface Box3D {
  width: number;
  length: number;
  height: number;
}

export interface PackedItem {
  itemIndex: number;
  cargoIndex: number;
  position: { x: number; y: number; z: number };
  rotatedDimensions: Box3D;
  fits: boolean;
}

export interface BinPackingResult {
  items: PackedItem[];
  utilizedCBM: number;
  totalCBM: number;
  truckCapacityCBM: number;
  utilizationPercent: number;
  canFitAll: boolean;
  unfittedItems: { cargoIndex: number; itemIndex: number; reason: string }[];
}
