import { describe, expect, it } from "vitest";
import { ChunkMeshBuilder } from "../../src/world/chunkMesh";
import { World } from "../../src/world/world";

/**
 * Golden values captured from the original single-file spike with its world seed fixed to 12345.
 * They pin the port to the spike: any change to the world logic that alters the ride fails here.
 * Update them only for a deliberate change to how the world looks.
 */
const SEED = 12345;
const CHUNKS: readonly (readonly [chunkIndex: number, vertexCount: number, fnv1a: number])[] = [
  [-1, 12884, 719151377], [0, 13184, 2901205157], [5, 12364, 1128379185], [37, 15396, 1322599629], [123, 10852, 1946178921],
];
const WARP_KEYFRAMES = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0.6607997417449951, 0.7331409454345703, 0, 0, 0],
  [0, 0, 0, 0, 0.638624906539917, 0, 0, 0],
  [0, -0.2599111497402191, 0, 0.8237289786338806, 0, 0, 0, 0],
  [0, 0.574704110622406, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0.7060125470161438, 0.9197601079940796, 0, 0],
];
const BIOME_KEYFRAMES = [
  { fnv1a: 1446074385, terrace: 3, gateSpacing: 64, gateGlows: true },
  { fnv1a: 106924624, terrace: 3, gateSpacing: 0, gateGlows: true },
  { fnv1a: 3484229527, terrace: 1, gateSpacing: 64, gateGlows: true },
];

function fnv1a(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (const byte of bytes) { hash ^= byte; hash = Math.imul(hash, 0x01000193); }
  return hash >>> 0;
}

describe("parity with the original spike", () => {
  const world = new World(SEED);

  it("builds byte-identical chunk meshes", () => {
    const builder = new ChunkMeshBuilder();
    for (const [chunkIndex, vertexCount, hash] of CHUNKS) {
      const mesh = builder.build(world, chunkIndex);
      expect(mesh.vertexCount).toBe(vertexCount);
      expect(fnv1a(mesh.bytes)).toBe(hash);
    }
  });

  it("produces the same warp keyframes", () => {
    WARP_KEYFRAMES.forEach((expected, index) => { expect(Array.from(world.warps.keyframe(index))).toEqual(expected); });
  });

  it("produces the same biome keyframes", () => {
    BIOME_KEYFRAMES.forEach((expected, index) => {
      const keyframe = world.biomes.keyframe(index);
      expect({ fnv1a: fnv1a(new Uint8Array(keyframe.numbers.buffer)), terrace: keyframe.terrace, gateSpacing: keyframe.gateSpacing, gateGlows: keyframe.gateGlows })
        .toEqual(expected);
    });
  });
});
