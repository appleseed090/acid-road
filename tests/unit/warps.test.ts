import { describe, expect, it } from "vitest";
import { WARP_SEGMENT_LENGTH } from "../../src/world/constants";
import { Warp, WARP_COUNT, WarpDirector, WARPS } from "../../src/world/warps";

const SEEDS = [0, 1, 12345, 987654321, 0x7ffffffe];

function expectInDeclaredRanges(values: Float32Array): void {
  WARPS.forEach(({ name, min, max }, i) => {
    // Values are stored as float32, so allow the rounding of a declared bound like -0.45.
    expect(values[i], name).toBeGreaterThanOrEqual(Math.fround(min));
    expect(values[i], name).toBeLessThanOrEqual(Math.fround(max));
  });
}

describe("WarpDirector", () => {
  it("gives the same keyframes and directed values for the same seed", () => {
    for (const seed of SEEDS) {
      const first = new WarpDirector(seed), second = new WarpDirector(seed);
      for (let index = 0; index < 60; index++) expect(second.keyframe(index)).toEqual(first.keyframe(index));
      const a = new Float32Array(WARP_COUNT), b = new Float32Array(WARP_COUNT);
      for (let travel = 0; travel < 50000; travel += 211.7) {
        first.directedWarps(travel, a);
        second.directedWarps(travel, b);
        expect(b).toEqual(a);
      }
    }
  });

  it("starts calm: keyframe 0 has every warp at 0", () => {
    for (const seed of SEEDS) expect(Array.from(new WarpDirector(seed).keyframe(0))).toEqual(new Array<number>(WARP_COUNT).fill(0));
  });

  it("keeps every keyframe inside the declared ranges", () => {
    for (const seed of SEEDS) {
      const director = new WarpDirector(seed);
      for (let index = 0; index < 2000; index++) expectInDeclaredRanges(director.keyframe(index));
    }
  });

  it("keeps eased values between keyframes inside the declared ranges", () => {
    const out = new Float32Array(WARP_COUNT);
    for (const seed of SEEDS) {
      const director = new WarpDirector(seed);
      for (let travel = 0; travel < 200 * WARP_SEGMENT_LENGTH; travel += 37.3) {
        director.directedWarps(travel, out);
        expectInDeclaredRanges(out);
      }
    }
  });

  it("never pairs a ceiling with a closed tube", () => {
    for (const seed of SEEDS) {
      const director = new WarpDirector(seed);
      for (let index = 0; index < 2000; index++) {
        const keyframe = director.keyframe(index);
        if (keyframe[Warp.ROLL] > 0.5) expect(keyframe[Warp.CEILING]).toBe(0);
      }
    }
  });
});
