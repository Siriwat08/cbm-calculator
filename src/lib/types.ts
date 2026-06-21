// ===== Core Types =====

// Re-export OilPriceEntry as the canonical oil price type
// (defined in oil-price-api.ts as the single source of truth)
export type { OilPriceEntry as OilPrice } from './oil-price-api';

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

/**
 * Wheel arch (ซุ้มล้อ) — พื้นที่ต้องห้ามวางของ
 * หน่วยเป็น เซนติเมตร (เหมือน cargo)
 *
 * พิกัด (x, y, z):
 *   x = ระยะจากผนังด้านซ้าย (แกนกว้าง)
 *   y = ระยะจากผนังด้านหน้ารถ (ฝั่งห้องโดยสาร) (แกนยาว)
 *   z = ระยะจากพื้นกระบะ (แกนสูง)
 */
export interface TruckObstacle {
  x: number;
  y: number;
  z: number;
  width: number;
  length: number;
  height: number;
  label?: string;
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
  /** ซุ้มล้อหรือสิ่งกีดขวางอื่น ๆ (optional — รถตู้พื้นเรียบไม่มี) */
  obstacles?: TruckObstacle[];
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
