import { BIOME_SEGMENT_LENGTH, ROAD_HALF_WIDTH } from "./constants";
import { hslToRgb, type Rgb } from "./color";
import { fractalNoise, sequence, smoothstep, valueNoise } from "./random";

/** Indices of the scalar fields at the start of {@link BiomeKeyframe.numbers}. */
export const BiomeNumber = {
  AMP_LOW: 0,
  AMP_HIGH: 1,
  RIDGE: 2,
  WALL: 3,
  PILLARS: 4,
  FLOATERS: 5,
  TREES: 6,
  LIGHT: 7,
} as const;

/** Which of the nine RGB triples stored after the scalars in {@link BiomeKeyframe.numbers}. */
export const BiomeColor = {
  LOW: 0,
  MID: 1,
  HIGH: 2,
  ACCENT: 3,
  ACCENT2: 4,
  ROAD: 5,
  FOG: 6,
  ZENITH: 7,
  LAMP: 8,
} as const;
export type BiomeColor = (typeof BiomeColor)[keyof typeof BiomeColor];

const BIOME_COLOR_OFFSET = 8;
const BIOME_COLOR_COUNT = 9;
/** Length of {@link BiomeKeyframe.numbers}: eight scalars, then nine RGB triples. */
export const BIOME_NUMBER_COUNT = BIOME_COLOR_OFFSET + BIOME_COLOR_COUNT * 3;

/**
 * Scenery settings for one point on the road. `numbers` holds everything that blends smoothly between
 * keyframes (see {@link BiomeNumber} and {@link BiomeColor}); the other fields snap to the nearer keyframe.
 * Callers must not mutate `numbers`: keyframes are cached and shared.
 */
export interface Biome {
  readonly numbers: Float32Array;
  /** Heights are rounded down to a multiple of this, giving stepped terraces. At least 1. */
  readonly terrace: number;
  /** Blocks between gates, or 0 for no gates. */
  readonly gateSpacing: number;
  readonly gateSize: number;
  readonly gateGlows: boolean;
}

/**
 * Scenery keyframes ("biomes") placed every {@link BIOME_SEGMENT_LENGTH} blocks. A pure function of
 * (seed, position along the road); results are memoised per instance.
 */
export class BiomeKeyframes {
  private readonly cache = new Map<number, Biome>();

  constructor(readonly seed: number) {}

  /** The keyframe at the start of segment `index`. */
  keyframe(index: number): Biome {
    const cached = this.cache.get(index);
    if (cached) return cached;
    const next = sequence(this.seed, index, 101);
    const hue = next() * 360, mood = next(), shape = Math.floor(next() * 5);
    let ampLow = 18, ampHigh = 3, ridge = 0, wall = 0, terrace = 1;
    if (shape === 0) { ampLow = 14 + next() * 14; }
    else if (shape === 1) { ampLow = 9; ampHigh = 4; wall = 0.3 + next() * 0.3; terrace = 2 + Math.floor(next() * 2); }
    else if (shape === 2) { ampLow = 24 + next() * 12; ridge = 1; ampHigh = 2; }
    else if (shape === 3) { ampLow = 5; ampHigh = 2; }
    else { ampLow = 24; ridge = 0.3; terrace = 5; }
    const pillars = (shape === 3 ? 0.012 : 0.002) * (next() < 0.6 ? 1 : 0) + (shape === 3 ? 0.004 : 0);
    const floaters = next() < 0.5 ? 0.0015 + next() * 0.004 : 0;
    const trees = next() < 0.55 && shape !== 3 ? 0.004 + next() * 0.012 : 0;
    const night = mood < 0.2, dusk = !night && mood < 0.45;
    const fogHue = hue + 160 + next() * 80;
    // Listed in BiomeColor order. Evaluation order matters: each next() call advances the sequence.
    const colors: Rgb[] = [
      hslToRgb(hue, 0.6, 0.3), hslToRgb(hue + 35 + next() * 30, 0.72, 0.5), hslToRgb(hue + 120 + next() * 80, 0.55, 0.78),
      hslToRgb(hue + 180, 0.9, 0.58), hslToRgb(hue + 250 + next() * 60, 0.95, 0.62), hslToRgb(hue + 200, 0.18, 0.2),
      night ? hslToRgb(fogHue, 0.5, 0.07) : dusk ? hslToRgb(fogHue, 0.75, 0.55) : hslToRgb(fogHue, 0.5, 0.8),
      night ? hslToRgb(fogHue + 30, 0.6, 0.02) : dusk ? hslToRgb(fogHue + 50, 0.7, 0.18) : hslToRgb(fogHue + 25, 0.65, 0.45),
      hslToRgb(hue + 60, 1, 0.7),
    ];
    const gateRoll = next();
    const keyframe: Biome = {
      numbers: new Float32Array([ampLow, ampHigh, ridge, wall, pillars, floaters, trees, night ? 0.72 : dusk ? 0.9 : 1, ...colors.flat()]),
      terrace,
      gateSpacing: gateRoll < 0.3 ? 0 : gateRoll < 0.6 ? 64 : gateRoll < 0.85 ? 96 : 32,
      gateSize: 4 + next() * 40,
      gateGlows: next() < 0.5,
    };
    this.cache.set(index, keyframe);
    return keyframe;
  }

  /** Scenery at road position `z`: each keyframe is held, then cross-faded through the middle of its segment. */
  at(z: number): Biome {
    const s = z / BIOME_SEGMENT_LENGTH, index = Math.floor(s), raw = s - index;
    const t = smoothstep(0.3, 0.7, raw);
    const a = this.keyframe(index), b = this.keyframe(index + 1), numbers = new Float32Array(BIOME_NUMBER_COUNT);
    for (let i = 0; i < numbers.length; i++) numbers[i] = a.numbers[i] + (b.numbers[i] - a.numbers[i]) * t;
    const nearest = t < 0.5 ? a : b;
    return { numbers, terrace: nearest.terrace, gateSpacing: nearest.gateSpacing, gateSize: nearest.gateSize, gateGlows: nearest.gateGlows };
  }
}

export function biomeColor(biome: Biome, which: BiomeColor): Rgb {
  const offset = BIOME_COLOR_OFFSET + which * 3;
  return [biome.numbers[offset], biome.numbers[offset + 1], biome.numbers[offset + 2]];
}

/** True for the columns that make up the flat road. */
export function isRoadColumn(x: number): boolean {
  return Math.abs(x + 0.5) < ROAD_HALF_WIDTH;
}

/**
 * Terrain height in whole blocks for column `x` at road position `z`. Always 0 on the road, never negative,
 * and always a multiple of the biome's terrace step.
 */
export function columnHeight(seed: number, x: number, z: number, biome: Biome): number {
  const lateral = Math.abs(x + 0.5);
  if (lateral < ROAD_HALF_WIDTH) return 0;
  const n = biome.numbers, base = fractalNoise(seed, x * 0.014, z * 0.014), ridged = 1 - Math.abs(2 * base - 1);
  const shaped = base + (ridged * ridged - base) * n[BiomeNumber.RIDGE];
  let h = (shaped - 0.28) * n[BiomeNumber.AMP_LOW] * 1.4 + valueNoise(seed, x * 0.07, z * 0.07, 9) * n[BiomeNumber.AMP_HIGH]
    + n[BiomeNumber.WALL] * Math.max(lateral - 10, 0);
  h *= smoothstep(3, 18, lateral);
  return Math.max(0, Math.floor(h / biome.terrace) * biome.terrace);
}
