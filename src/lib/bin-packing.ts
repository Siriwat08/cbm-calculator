/**
 * 3D Bin Packing Algorithm (First Fit Decreasing with Rotation)
 *
 * This algorithm determines if cargo items can actually fit inside a truck
 * by considering 3D placement, not just total volume comparison.
 *
 * Approach:
 * 1. Sort items by volume (largest first) - First Fit Decreasing
 * 2. Try to place each item in the truck space
 * 3. When an item is placed, it creates 3 sub-spaces (right, front, top)
 * 4. Try all 6 rotations for each item
 * 5. Report which items fit and which don't
 */

import { Box3D, CargoItem, TruckType, PackedItem, BinPackingResult } from './types';

interface Space3D {
  x: number;
  y: number;
  z: number;
  width: number;
  length: number;
  height: number;
}

interface PlacedBox {
  x: number;
  y: number;
  z: number;
  width: number;
  length: number;
  height: number;
  cargoIndex: number;
  itemIndex: number;
}

// All 6 possible rotations of a 3D box (deduplicated for cubes/square prisms)
function getRotations(box: Box3D): Box3D[] {
  const { width: w, length: l, height: h } = box;
  const all = [
    { width: w, length: l, height: h },
    { width: w, length: h, height: l },
    { width: l, length: w, height: h },
    { width: l, length: h, height: w },
    { width: h, length: w, height: l },
    { width: h, length: l, height: w },
  ];
  // Deduplicate: for a cube all 6 are identical, for a square prism some overlap
  const seen = new Set<string>();
  return all.filter(r => {
    const key = `${r.width}-${r.length}-${r.height}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Check if a box can fit in a space
function canFitInSpace(box: Box3D, space: Space3D): boolean {
  return (
    box.width <= space.width &&
    box.length <= space.length &&
    box.height <= space.height
  );
}

// Check if a candidate space overlaps with any already-placed box
function hasNoOverlap(
  space: Space3D,
  placedBoxes: PlacedBox[]
): boolean {
  for (const placed of placedBoxes) {
    const overlapX = space.x < placed.x + placed.width && space.x + space.width > placed.x;
    const overlapY = space.y < placed.y + placed.length && space.y + space.length > placed.y;
    const overlapZ = space.z < placed.z + placed.height && space.z + space.height > placed.z;

    if (overlapX && overlapY && overlapZ) {
      return false;
    }
  }
  return true;
}

// Generate sub-spaces after placing a box in a space (Guillotine cut)
function generateSubSpaces(
  space: Space3D,
  placedBox: PlacedBox
): Space3D[] {
  const subSpaces: Space3D[] = [];

  // Right space
  const rightWidth = space.x + space.width - (placedBox.x + placedBox.width);
  if (rightWidth > 0) {
    subSpaces.push({
      x: placedBox.x + placedBox.width,
      y: space.y,
      z: space.z,
      width: rightWidth,
      length: space.length,
      height: space.height,
    });
  }

  // Front space
  const frontLength = space.y + space.length - (placedBox.y + placedBox.length);
  if (frontLength > 0) {
    subSpaces.push({
      x: space.x,
      y: placedBox.y + placedBox.length,
      z: space.z,
      width: space.width,
      length: frontLength,
      height: space.height,
    });
  }

  // Top space
  const topHeight = space.z + space.height - (placedBox.z + placedBox.height);
  if (topHeight > 0) {
    subSpaces.push({
      x: space.x,
      y: space.y,
      z: placedBox.z + placedBox.height,
      width: space.width,
      length: space.length,
      height: topHeight,
    });
  }

  return subSpaces;
}

// Check if space is fully inside another space
function isSpaceInside(inner: Space3D, outer: Space3D): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.z >= outer.z &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.length <= outer.y + outer.length &&
    inner.z + inner.height <= outer.z + outer.height
  );
}

// Main 3D Bin Packing function
export function performBinPacking(
  cargoItems: CargoItem[],
  truck: TruckType
): BinPackingResult {
  const truckDimensions = truck.dimensions;

  // Convert truck dimensions from meters to centimeters for consistent units with cargo
  const truckW = truckDimensions.width * 100;
  const truckL = truckDimensions.length * 100;
  const truckH = truckDimensions.height * 100;

  // Apply usable space factor
  const usableFactor = truck.usableSpace / 100;
  const effectiveW = truckW * Math.cbrt(usableFactor);
  const effectiveL = truckL * Math.cbrt(usableFactor);
  const effectiveH = truckH * Math.cbrt(usableFactor);

  const truckCapacityCBM = (truckW * truckL * truckH) / 1000000;

  // Build list of all individual items to pack (expanding quantities)
  interface ItemToPack {
    cargoIndex: number;
    itemIndex: number;
    dimensions: Box3D;
    volume: number;
  }

  const itemsToPack: ItemToPack[] = [];
  cargoItems.forEach((item, cargoIdx) => {
    if (item.width <= 0 || item.length <= 0 || item.height <= 0) return;
    for (let i = 0; i < item.quantity; i++) {
      itemsToPack.push({
        cargoIndex: cargoIdx,
        itemIndex: i,
        dimensions: { width: item.width, length: item.length, height: item.height },
        volume: item.width * item.length * item.height,
      });
    }
  });

  // Sort by volume descending (First Fit Decreasing)
  itemsToPack.sort((a, b) => b.volume - a.volume);

  // Initialize available spaces with the entire truck
  let availableSpaces: Space3D[] = [
    { x: 0, y: 0, z: 0, width: effectiveW, length: effectiveL, height: effectiveH },
  ];

  const placedBoxes: PlacedBox[] = [];
  const packedItems: PackedItem[] = [];
  const unfittedItems: { cargoIndex: number; itemIndex: number; reason: string }[] = [];
  let utilizedCBM = 0;

  for (const item of itemsToPack) {
    const rotations = getRotations(item.dimensions);
    let placed = false;

    // Sort available spaces by volume (smallest first to find tightest fit)
    availableSpaces.sort((a, b) => {
      const volA = a.width * a.length * a.height;
      const volB = b.width * b.length * b.height;
      return volA - volB;
    });

    for (const rotation of rotations) {
      if (placed) break;

      for (const space of availableSpaces) {
        if (placed) break;

        if (!canFitInSpace(rotation, space)) continue;

        // Place the item at the corner of this space
        const newBox: PlacedBox = {
          x: space.x,
          y: space.y,
          z: space.z,
          width: rotation.width,
          length: rotation.length,
          height: rotation.height,
          cargoIndex: item.cargoIndex,
          itemIndex: item.itemIndex,
        };

        // Verify no overlap with existing boxes
        if (!hasNoOverlap(newBox, placedBoxes)) continue;

        // Place the box
        placedBoxes.push(newBox);
        utilizedCBM += item.volume;

        packedItems.push({
          itemIndex: item.itemIndex,
          cargoIndex: item.cargoIndex,
          position: { x: newBox.x, y: newBox.y, z: newBox.z },
          rotatedDimensions: rotation,
          fits: true,
        });

        // Generate new sub-spaces
        const subSpaces = generateSubSpaces(space, newBox);

        // Remove the used space and add sub-spaces
        availableSpaces = availableSpaces.filter(s => s !== space);
        availableSpaces.push(...subSpaces);

        // Clean up: remove spaces that are inside other spaces or overlap with placed boxes
        availableSpaces = availableSpaces.filter(space => {
          // Must not overlap any placed box
          return hasNoOverlap(space, placedBoxes);
        });

        // Remove redundant spaces (spaces completely inside other spaces)
        availableSpaces = availableSpaces.filter((space, idx, arr) => {
          return !arr.some((other, otherIdx) =>
            otherIdx !== idx && isSpaceInside(space, other)
          );
        });

        // Cap available spaces to prevent unbounded growth (O(n²) cleanup)
        // Keep only the largest 50 spaces — sufficient for typical cargo scenarios
        if (availableSpaces.length > 50) {
          availableSpaces.sort((a, b) => (b.width * b.length * b.height) - (a.width * a.length * a.height));
          availableSpaces = availableSpaces.slice(0, 50);
        }

        placed = true;
      }
    }

    if (!placed) {
      unfittedItems.push({
        cargoIndex: item.cargoIndex,
        itemIndex: item.itemIndex,
        reason: `ไม่สามารถวางสินค้าได้ (ขนาด ${item.dimensions.width}×${item.dimensions.length}×${item.dimensions.height} ซม.)`,
      });
    }
  }

  const totalCBM = itemsToPack.reduce((sum, item) => sum + item.volume, 0) / 1000000;
  const utilizationPercent = truckCapacityCBM > 0 ? (utilizedCBM / (truckCapacityCBM * 1000000)) * 100 : 0;

  return {
    items: packedItems,
    utilizedCBM: utilizedCBM / 1000000,
    totalCBM,
    truckCapacityCBM,
    utilizationPercent,
    canFitAll: unfittedItems.length === 0,
    unfittedItems,
  };
}
