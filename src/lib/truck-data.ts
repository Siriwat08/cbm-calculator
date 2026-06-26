import { TruckType } from './types';

/** @deprecated Use FALLBACK_DIESEL_PRICE from oil-price-api instead */
export { FALLBACK_DIESEL_PRICE as FALLBACK_OIL_PRICE } from './oil-price-api';

/** @deprecated Use LABOR_COST from oil-price-api instead */
export { LABOR_COST } from './oil-price-api';

export const truckTypes: TruckType[] = [
  {
    id: 'pickup',
    name: 'รถกระบะตู้ทึบ',
    image: '/images/Screenshot_20260320_125706_OneDrive.jpg',
    cbm: 6,
    maxWeight: 1500,
    // มิติจริง Revo ตอนเดียว (วัดเองเมื่อ 2026-05)
    //   ความกว้างในจุดกว้างสุด: 1,575 มม.
    //   ความยาวใน: 2,315 มม.
    //   ความสูงตู้ทึบจากพื้นกระบะ: 2,100 มม.
    dimensions: { width: 1.575, length: 2.315, height: 2.1 },
    usableSpace: 100, // ใช้พื้นที่เต็ม 100% เพราะมีการตัดซุ้มล้อแบบเจาะจงตำแหน่งแล้ว
    jobKey: '4ล้อ_PPY',
    // ซุ้มล้อ Revo ตอนเดียว — 2 ข้าง (ซ้าย+ขวา)
    //   มิติซุ้มล้อ: กว้าง 23.75 ซม. × ยาว 80 ซม. × สูง 20 ซม. (ต่อข้าง)
    //   ตำแหน่ง:
    //     x=0        (ชิดผนังซ้าย)         — ซุ้มล้อซ้าย
    //     x=133.75   (157.5 − 23.75 = 133.75) — ซุ้มล้อขวา ชิดผนังขวา
    //     y=72.5     (ห่างจากผนังหน้ารถ 72.5 ซม.)
    //     z=0        (วางบนพื้นกระบะ)
    //   พื้นที่เหนือซุ้มล้อ (z ≥ 20) ยังใช้วางของได้
    obstacles: [
      { x: 0, y: 72.5, z: 0, width: 23.75, length: 80, height: 20, label: 'ซุ้มล้อซ้าย' },
      { x: 133.75, y: 72.5, z: 0, width: 23.75, length: 80, height: 20, label: 'ซุ้มล้อขวา' },
    ],
  },
  {
    id: 'jumbo',
    name: 'รถ 4 ล้อจัมโบ้',
    image: '/images/Screenshot_20260320_125652_OneDrive.jpg',
    cbm: 11,
    maxWeight: 3000,
    dimensions: { width: 1.8, length: 3.2, height: 2.1 },
    usableSpace: 100, // รถตู้พื้นเรียบ ไม่มีซุ้มล้อ
    jobKey: '4จัมโบ้_PPY',
    // ไม่มี obstacles — เป็นรถตู้พื้นเรียบ
  },
  {
    id: '6wheel',
    name: 'รถ 6 ล้อ',
    image: '/images/Screenshot_20260320_125638_OneDrive.jpg',
    cbm: 32,
    maxWeight: 6000,
    dimensions: { width: 2.4, length: 6.6, height: 2.35 },
    usableSpace: 90,
    jobKey: '6ล้อ_PPY',
    // ไม่มี obstacles — เป็นรถตู้พื้นเรียบ
  },
];

export function getTruckByJobKey(jobKey: string): TruckType | undefined {
  return truckTypes.find(t => t.jobKey === jobKey);
}

export function getJobKeyByTruckId(truckId: string): string | undefined {
  return truckTypes.find(t => t.id === truckId)?.jobKey;
}

// ===== Gross / Net / Obstacle CBM (จากแอปลูกค้า MESPACE) =====

/** คำนวณ Gross CBM = กว้าง × ยาว × สูง (หน่วย ลบ.ม.) */
export function getTruckGrossCBM(truck: TruckType): number {
  return truck.dimensions.width * truck.dimensions.length * truck.dimensions.height;
}

/** คำนวณ Obstacle CBM = ผลรวมปริมาตรของสิ่งกีดขวางทั้งหมด (ซุ้มล้อ ฯลฯ) หน่วย ลบ.ม. */
export function getTruckObstacleCBM(truck: TruckType): number {
  return (truck.obstacles || []).reduce((sum, obstacle) => {
    return sum + (obstacle.width * obstacle.length * obstacle.height) / 1000000;
  }, 0);
}

/** คำนวณ Net CBM = Gross CBM - Obstacle CBM */
export function getTruckNetCBM(truck: TruckType): number {
  return Math.max(getTruckGrossCBM(truck) - getTruckObstacleCBM(truck), 0);
}
