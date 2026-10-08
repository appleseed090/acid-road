import { describe, expect, it } from "vitest";
import { BIOME_NUMBER_COUNT, BiomeKeyframes, columnHeight, isRoadColumn } from "../../src/world/biomes";
import { BIOME_SEGMENT_LENGTH, HALF_WIDTH } from "../../src/world/constants";

const SEEDS = [0, 1, 12345, 987654321, 0x7ffffffe];

describe("BiomeKeyframes", () => {
  it("gives the same keyframes for the same seed", () => {
    for (const seed of SEEDS) {
      const first = new BiomeKeyframes(seed), second = new BiomeKeyframes(seed);
      for (let index = -2; index < 40; index++) expect(second.keyframe(index)).toEqual(first.keyframe(index));
      for (let z = -100; z < 20000; z += 333) expect(second.at(z)).toEqual(first.at(z));
    }
  });

  it("gives different scenery for different seeds", () => {
    expect(new BiomeKeyframes(1).keyframe(3).numbers).not.toEqual(new BiomeKeyframes(2).keyframe(3).numbers);
  });

  it("holds each keyframe exactly through the first 30% of its segment", () => {
    const biomes = new BiomeKeyframes(99);
    expect(biomes.at(5 * BIOME_SEGMENT_LENGTH + 10).numbers).toEqual(biomes.keyframe(5).numbers);
  });

  it("produces well-formed keyframes", () => {
    const biomes = new BiomeKeyframes(77);
    for (let index = 0; index < 200; index++) {
      const biome = biomes.keyframe(index);
      expect(biome.numbers).toHaveLength(BIOME_NUMBER_COUNT);
      expect(Number.isInteger(biome.terrace) && biome.terrace >= 1).toBe(true);
      expect([0, 32, 64, 96]).toContain(biome.gateSpacing);
    }
  });
});

describe("columnHeight", () => {
  it("keeps the road corridor at height 0 for every seed and position", () => {
    const roadColumns: number[] = [];
    for (let x = -HALF_WIDTH; x < HALF_WIDTH; x++) if (isRoadColumn(x)) roadColumns.push(x);
    expect(roadColumns).toEqual([-3, -2, -1, 0, 1, 2]);
    for (const seed of SEEDS) {
      const biomes = new BiomeKeyframes(seed);
      for (let z = -64; z < 30000; z += 13) {
        const biome = biomes.at(z);
        for (const x of roadColumns) expect(columnHeight(seed, x, z, biome)).toBe(0);
      }
    }
  });

  it("never goes negative and snaps to the terrace step", () => {
    for (const seed of SEEDS) {
      const biomes = new BiomeKeyframes(seed);
      for (let z = 0; z < 20000; z += 97) {
        const biome = biomes.at(z);
        for (let x = -HALF_WIDTH - 1; x <= HALF_WIDTH; x += 3) {
          const height = columnHeight(seed, x, z, biome);
          expect(height).toBeGreaterThanOrEqual(0);
          expect(height % biome.terrace).toBe(0);
        }
      }
    }
  });
});
