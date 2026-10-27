/**
 * Picks which words to hide in fill mode, as indexes into the segment's words.
 * The choice depends only on the seed, so a segment hides the same words every
 * time it's shown. Any ratio above 0 hides at least one word.
 */
export function pickHiddenWords(wordCount: number, ratio: number, seed: string): Set<number> {
  if (ratio <= 0 || wordCount === 0) return new Set();
  const count = Math.min(wordCount, Math.max(1, Math.round(wordCount * ratio)));
  const indexes = Array.from({ length: wordCount }, (_, i) => i);
  if (count === wordCount) return new Set(indexes);

  // Seeded Fisher–Yates shuffle, then take the first `count`.
  const random = mulberry32(hashString(seed));
  for (let i = indexes.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  return new Set(indexes.slice(0, count));
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small, fast seeded random number generator returning values in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
