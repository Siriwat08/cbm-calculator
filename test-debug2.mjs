// Detailed debug of the isSpaceInside cleanup

function isSpaceInside(inner, outer) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.z >= outer.z &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.length <= outer.y + outer.length &&
    inner.z + inner.height <= outer.z + outer.height
  );
}

// Simulated spaces after obstacle processing
const spaces = [
  { x: 0, y: 152.5, z: 0, width: 146.21, length: 62.41, height: 194.95 },  // front
  { x: 0, y: 0, z: 20, width: 146.21, length: 214.91, height: 174.95 },    // top
  { x: 0, y: 152.5, z: 0, width: 146.21, length: 62.41, height: 194.95 },  // front (dup from obs2)
  { x: 0, y: 0, z: 20, width: 146.21, length: 214.91, height: 174.95 },    // top (dup from obs2)
];

console.log('=== Spaces before cleanup ===');
spaces.forEach((s, i) => {
  console.log(`  ${i}: x=${s.x}-${(s.x+s.width).toFixed(2)}, y=${s.y}-${(s.y+s.length).toFixed(2)}, z=${s.z}-${(s.z+s.height).toFixed(2)}`);
});

console.log('\n=== isSpaceInside checks ===');
for (let i = 0; i < spaces.length; i++) {
  for (let j = 0; j < spaces.length; j++) {
    if (i === j) continue;
    const result = isSpaceInside(spaces[i], spaces[j]);
    if (result) {
      console.log(`  Space[${i}] is INSIDE Space[${j}] → Space[${i}] will be REMOVED`);
    }
  }
}

// Run the actual filter
const filtered = spaces.filter((space, idx, arr) => {
  return !arr.some((other, otherIdx) =>
    otherIdx !== idx && isSpaceInside(space, other)
  );
});

console.log(`\n=== After cleanup: ${filtered.length} spaces ===`);
filtered.forEach((s, i) => {
  console.log(`  ${i}: x=${s.x}-${(s.x+s.width).toFixed(2)}, y=${s.y}-${(s.y+s.length).toFixed(2)}, z=${s.z}-${(s.z+s.height).toFixed(2)}`);
});

// Now test with deduplication first
console.log('\n\n=== FIX: Deduplicate first ===');
const seen = new Set();
const deduped = spaces.filter(s => {
  const key = `${s.x},${s.y},${s.z},${s.width},${s.length},${s.height}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
console.log(`After dedup: ${deduped.length} spaces`);
deduped.forEach((s, i) => {
  console.log(`  ${i}: x=${s.x}-${(s.x+s.width).toFixed(2)}, y=${s.y}-${(s.y+s.length).toFixed(2)}, z=${s.z}-${(s.z+s.height).toFixed(2)}`);
});

// Check isSpaceInside on deduped
const filtered2 = deduped.filter((space, idx, arr) => {
  return !arr.some((other, otherIdx) =>
    otherIdx !== idx && isSpaceInside(space, other)
  );
});
console.log(`After isSpaceInside cleanup: ${filtered2.length} spaces`);
filtered2.forEach((s, i) => {
  console.log(`  ${i}: x=${s.x}-${(s.x+s.width).toFixed(2)}, y=${s.y}-${(s.y+s.length).toFixed(2)}, z=${s.z}-${(s.z+s.height).toFixed(2)}`);
});
