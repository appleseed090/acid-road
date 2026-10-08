/**
 * Deterministic randomness. Every function here is a pure function of its arguments,
 * so a given world seed always produces the same ride.
 */

/** Hashes three integers and a world seed to a uniform number in [0, 1). Non-integer inputs are truncated. */
export function hash3(seed: number, a: number, b: number, c: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul((c + seed) | 0, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Returns a generator of independent uniform numbers in [0, 1), keyed by (seed, key, salt). */
export function sequence(seed: number, key: number, salt: number): () => number {
  let n = 0;
  return () => hash3(seed, key, n++, salt);
}

/** Hermite smoothstep: 0 at or below `low`, 1 at or above `high`, smooth in between. */
export function smoothstep(low: number, high: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

/** Smoothly interpolated lattice noise in [0, 1). `salt` selects an independent noise field. */
export function valueNoise(seed: number, x: number, y: number, salt: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash3(seed, ix, iy, salt), b = hash3(seed, ix + 1, iy, salt);
  const c = hash3(seed, ix, iy + 1, salt), d = hash3(seed, ix + 1, iy + 1, salt);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Four octaves of value noise, normalised to [0, 1). */
export function fractalNoise(seed: number, x: number, y: number): number {
  return (
    valueNoise(seed, x, y, 1) * 8 +
    valueNoise(seed, x * 2.1, y * 2.1, 2) * 4 +
    valueNoise(seed, x * 4.3, y * 4.3, 3) * 2 +
    valueNoise(seed, x * 8.7, y * 8.7, 4)
  ) / 15;
}

/** Picks a fresh random world seed. The only non-deterministic function in the world logic. */
export function randomSeed(): number {
  return (Math.random() * 0x7fffffff) | 0;
}
