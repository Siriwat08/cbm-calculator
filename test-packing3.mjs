import { performBinPacking } from './src/lib/bin-packing.ts';

// Test 1: Pickup with wheel arches
console.log('=== Test 1: Revo Pickup with wheel arches ===');
const pickup = {
  id: 'pickup', name: 'รถกระบะตู้ทึบ', image: '', cbm: 6, maxWeight: 1500,
  dimensions: { width: 1.575, length: 2.315, height: 2.100 },
  usableSpace: 80, jobKey: '4ล้อ_PPY',
  obstacles: [
    { x: 0, y: 72.5, z: 0, width: 23.75, length: 80, height: 20, label: 'ซุ้มล้อซ้าย' },
    { x: 133.75, y: 72.5, z: 0, width: 23.75, length: 80, height: 20, label: 'ซุ้มล้อขวา' },
  ],
};

// Test with various cargo sizes
const cargo1 = [
  { id: '1', width: 60, length: 40, height: 50, quantity: 10, weight: 30 },
  { id: '2', width: 30, length: 30, height: 30, quantity: 20, weight: 15 },
];
const r1 = performBinPacking(cargo1, pickup);
console.log(`  Packed: ${r1.items.length}, Unfitted: ${r1.unfittedItems.length}, Util: ${r1.utilizationPercent.toFixed(1)}%`);

// Test 2: Jumbo (no obstacles)
console.log('\n=== Test 2: Jumbo 4-wheel (no obstacles) ===');
const jumbo = {
  id: 'jumbo', name: 'รถ 4 ล้อจัมโบ้', image: '', cbm: 11, maxWeight: 3000,
  dimensions: { width: 1.80, length: 3.20, height: 2.10 },
  usableSpace: 100, jobKey: '4จัมโบ้_PPY',
};
const r2 = performBinPacking(cargo1, jumbo);
console.log(`  Packed: ${r2.items.length}, Unfitted: ${r2.unfittedItems.length}, Util: ${r2.utilizationPercent.toFixed(1)}%`);

// Test 3: 6-wheel (no obstacles)
console.log('\n=== Test 3: 6-wheel (no obstacles) ===');
const sixwheel = {
  id: '6wheel', name: 'รถ 6 ล้อ', image: '', cbm: 32, maxWeight: 6000,
  dimensions: { width: 2.40, length: 6.60, height: 2.35 },
  usableSpace: 90, jobKey: '6ล้อ_PPY',
};
const r3 = performBinPacking(cargo1, sixwheel);
console.log(`  Packed: ${r3.items.length}, Unfitted: ${r3.unfittedItems.length}, Util: ${r3.utilizationPercent.toFixed(1)}%`);

// Test 4: Large cargo that barely fits
console.log('\n=== Test 4: Large cargo in pickup ===');
const cargo2 = [
  { id: '1', width: 100, length: 100, height: 100, quantity: 5, weight: 50 },
];
const r4 = performBinPacking(cargo2, pickup);
console.log(`  Packed: ${r4.items.length}, Unfitted: ${r4.unfittedItems.length}, Util: ${r4.utilizationPercent.toFixed(1)}%`);

// Test 5: Very large cargo that shouldn't fit
console.log('\n=== Test 5: Oversized cargo in pickup ===');
const cargo3 = [
  { id: '1', width: 150, length: 220, height: 200, quantity: 1, weight: 500 },
];
const r5 = performBinPacking(cargo3, pickup);
console.log(`  Packed: ${r5.items.length}, Unfitted: ${r5.unfittedItems.length}, canFit: ${r5.canFitAll}`);

console.log('\n✅ All tests completed');
