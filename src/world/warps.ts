import { WARP_SEGMENT_LENGTH } from "./constants";
import { sequence, smoothstep } from "./random";

/** One warp control: its display name and the range its value may take. */
export interface WarpDefinition {
  readonly name: string;
  readonly min: number;
  readonly max: number;
}

/** Every warp, in the order the warp arrays and shader uniforms use. */
export const WARPS: readonly WarpDefinition[] = [
  { name: "Twist", min: -1, max: 1 },
  { name: "Roll", min: -0.45, max: 1 },
  { name: "Rise", min: -1, max: 1 },
  { name: "Swerve", min: -1, max: 1 },
  { name: "Waves", min: 0, max: 1 },
  { name: "Stretch", min: -0.8, max: 1 },
  { name: "Pinch", min: -0.8, max: 0.8 },
  { name: "Ceiling", min: 0, max: 1 },
];

/** Positions within a warp array. */
export const Warp = {
  TWIST: 0,
  ROLL: 1,
  RISE: 2,
  SWERVE: 3,
  WAVES: 4,
  STRETCH: 5,
  PINCH: 6,
  CEILING: 7,
} as const;

export const WARP_COUNT = WARPS.length;

/**
 * The automatic warp sequence: a keyframe every {@link WARP_SEGMENT_LENGTH} blocks, eased between.
 * A pure function of (seed, travel); keyframes are memoised per instance. Keyframe 0 is always calm.
 */
export class WarpDirector {
  private readonly cache = new Map<number, Float32Array>();

  constructor(readonly seed: number) {}

  /** Warp values at the start of segment `index`. Callers must not mutate the result: it is cached. */
  keyframe(index: number): Float32Array {
    const cached = this.cache.get(index);
    if (cached) return cached;
    const keyframe = new Float32Array(WARP_COUNT);
    const next = sequence(this.seed, index, 202);
    if (index > 0 && next() > 0.12) {
      const count = 1 + Math.floor(next() * 2.7);
      for (let c = 0; c < count; c++) {
        const which = Math.floor(next() * WARP_COUNT), { min, max } = WARPS[which];
        const magnitude = 0.45 + 0.55 * next();
        keyframe[which] = (min < 0 && next() < 0.5 ? min : max) * magnitude;
      }
      if (keyframe[Warp.ROLL] > 0.5) keyframe[Warp.CEILING] = 0; // a ceiling inside a closed tube just clips through it
    }
    this.cache.set(index, keyframe);
    return keyframe;
  }

  /** Writes the warp values at distance `travel` into `out`, which must have {@link WARP_COUNT} entries. */
  directedWarps(travel: number, out: Float32Array): void {
    const s = travel / WARP_SEGMENT_LENGTH, index = Math.floor(s), t = smoothstep(0, 1, s - index);
    const a = this.keyframe(index), b = this.keyframe(index + 1);
    for (let i = 0; i < out.length; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  }
}
