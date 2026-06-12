// Pure JS debug - no imports needed

const truckW = 157.5, truckL = 231.5, truckH = 210.0;
const usableFactor = 0.80;
const cbrt = Math.cbrt(usableFactor);
const effectiveW = truckW * cbrt;
const effectiveL = truckL * cbrt;
const effectiveH = truckH * cbrt;

console.log('Effective truck:', effectiveW.toFixed(2), 'x', effectiveL.toFixed(2), 'x', effectiveH.toFixed(2));

const obstacleBoxes = [
  { x: 0, y: 72.5, z: 0, width: 23.75, length: 80, height: 20 },
  { x: 133.75, y: 72.5, z: 0, width: 23.75, length: 80, height: 20 },
];

console.log('\nObstacles:');
obstacleBoxes.forEach((o, i) => {
  console.log(`  ${i}: x=${o.x}-${o.x+o.width}, y=${o.y}-${o.y+o.length}, z=${o.z}-${o.z+o.height}`);
  const inBounds = o.x + o.width <= effectiveW && o.y + o.length <= effectiveL && o.z + o.height <= effectiveH;
  console.log(`    In effective bounds: ${inBounds} (rightEdge=${(o.x+o.width).toFixed(2)} vs effectiveW=${effectiveW.toFixed(2)})`);
});

function hasNoOverlap(space, placedBoxes) {
  for (const placed of placedBoxes) {
    const overlapX = space.x < placed.x + placed.width && space.x + space.width > placed.x;
    const overlapY = space.y < placed.y + placed.length && space.y + space.length > placed.y;
    const overlapZ = space.z < placed.z + placed.height && space.z + space.height > placed.z;
    if (overlapX && overlapY && overlapZ) return false;
  }
  return true;
}

function generateSubSpaces(space, placedBox) {
  const subSpaces = [];
  const rightWidth = space.x + space.width - (placedBox.x + placedBox.width);
  if (rightWidth > 0) subSpaces.push({ x: placedBox.x + placedBox.width, y: space.y, z: space.z, width: rightWidth, length: space.length, height: space.height });
  const frontLength = space.y + space.length - (placedBox.y + placedBox.length);
  if (frontLength > 0) subSpaces.push({ x: space.x, y: placedBox.y + placedBox.length, z: space.z, width: space.width, length: frontLength, height: space.height });
  const topHeight = space.z + space.height - (placedBox.z + placedBox.height);
  if (topHeight > 0) subSpaces.push({ x: space.x, y: space.y, z: placedBox.z + placedBox.height, width: space.width, length: space.length, height: topHeight });
  return subSpaces;
}

function isSpaceInside(inner, outer) {
  return inner.x >= outer.x && inner.y >= outer.y && inner.z >= outer.z &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.length <= outer.y + outer.length &&
    inner.z + inner.height <= outer.z + outer.height;
}

let availableSpaces = [
  { x: 0, y: 0, z: 0, width: effectiveW, length: effectiveL, height: effectiveH },
];

for (const obs of obstacleBoxes) {
  console.log(`\nProcessing obstacle: x=${obs.x}-${obs.x+obs.width}, y=${obs.y}-${obs.y+obs.length}, z=${obs.z}-${obs.z+obs.height}`);
  
  const before = availableSpaces.length;
  availableSpaces = availableSpaces.filter(space => hasNoOverlap(space, [obs]));
  console.log(`  Filtered: ${before} -> ${availableSpaces.length} spaces`);
  
  const subSpaces = generateSubSpaces(
    { x: 0, y: 0, z: 0, width: effectiveW, length: effectiveL, height: effectiveH },
    obs
  );
  console.log(`  Generated ${subSpaces.length} sub-spaces:`);
  subSpaces.forEach((s, i) => {
    const noOverlap = obstacleBoxes.every(ob => hasNoOverlap(s, [ob]));
    console.log(`    ${i}: x=${s.x.toFixed(1)}-${(s.x+s.width).toFixed(1)}, y=${s.y.toFixed(1)}-${(s.y+s.length).toFixed(1)}, z=${s.z.toFixed(1)}-${(s.z+s.height).toFixed(1)} | noOverlap=${noOverlap}`);
    if (noOverlap) availableSpaces.push(s);
  });
}

// Clean up redundant spaces
availableSpaces = availableSpaces.filter((space, idx, arr) => {
  return !arr.some((other, otherIdx) =>
    otherIdx !== idx && isSpaceInside(space, other)
  );
});

console.log('\n=== Final Available Spaces ===');
availableSpaces.forEach((s, i) => {
  const vol = (s.width * s.length * s.height / 1000000).toFixed(3);
  console.log(`  ${i}: x=${s.x.toFixed(1)}-${(s.x+s.width).toFixed(1)}, y=${s.y.toFixed(1)}-${(s.y+s.length).toFixed(1)}, z=${s.z.toFixed(1)}-${(s.z+s.height).toFixed(1)} | vol=${vol} m³`);
});

// Try to place a 20x20x20 box
const testBox = { width: 20, length: 20, height: 20 };
console.log('\n=== Trying to place 20x20x20 box ===');
availableSpaces.sort((a, b) => (a.width * a.length * a.height) - (b.width * b.length * b.height));
for (const space of availableSpaces) {
  const fits = testBox.width <= space.width && testBox.length <= space.length && testBox.height <= space.height;
  console.log(`  Space (${space.width.toFixed(1)}x${space.length.toFixed(1)}x${space.height.toFixed(1)}): fits=${fits}`);
  if (fits) {
    const newBox = { x: space.x, y: space.y, z: space.z, width: 20, length: 20, height: 20 };
    const noOverlap = hasNoOverlap(newBox, obstacleBoxes);
    console.log(`    Place at (${newBox.x}, ${newBox.y}, ${newBox.z}): noOverlapWithObstacles=${noOverlap}`);
    break;
  }
}
