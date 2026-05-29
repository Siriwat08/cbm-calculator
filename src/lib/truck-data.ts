import { TruckType } from './types';
import { FALLBACK_DIESEL_PRICE } from './oil-price-api';

export const truckTypes: TruckType[] = [
  {
    id: 'pickup',
    name: 'รถกระบะตู้ทึบ',
    image: '/images/Screenshot_20260320_125706_OneDrive.jpg',
    cbm: 6,
    maxWeight: 1500,
    dimensions: { width: 1.65, length: 2.30, height: 2.0 },
    usableSpace: 80,
    jobKey: '4ล้อ_PPY',
  },
  {
    id: 'jumbo',
    name: 'รถ 4 ล้อจัมโบ้',
    image: '/images/Screenshot_20260320_125652_OneDrive.jpg',
    cbm: 11,
    maxWeight: 3000,
    dimensions: { width: 1.80, length: 3.20, height: 2.10 },
    usableSpace: 100,
    jobKey: '4จัมโบ้_PPY',
  },
  {
    id: '6wheel',
    name: 'รถ 6 ล้อ',
    image: '/images/Screenshot_20260320_125638_OneDrive.jpg',
    cbm: 32,
    maxWeight: 6000,
    dimensions: { width: 2.40, length: 6.60, height: 2.35 },
    usableSpace: 90,
    jobKey: '6ล้อ_PPY',
  },
];

/** @deprecated Use FALLBACK_DIESEL_PRICE from oil-price-api instead */
export const FALLBACK_OIL_PRICE = FALLBACK_DIESEL_PRICE;

export function getTruckByJobKey(jobKey: string): TruckType | undefined {
  return truckTypes.find(t => t.jobKey === jobKey);
}

export function getJobKeyByTruckId(truckId: string): string | undefined {
  return truckTypes.find(t => t.id === truckId)?.jobKey;
}
