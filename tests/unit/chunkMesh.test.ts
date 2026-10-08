import { describe, expect, it } from "vitest";
import { ChunkMeshBuilder, MAX_CHUNK_VERTICES, VERTEX_BYTES } from "../../src/world/chunkMesh";
import { World } from "../../src/world/world";

describe("ChunkMeshBuilder", () => {
  it("never exceeds the default vertex cap and only emits whole quads", () => {
    const builder = new ChunkMeshBuilder();
    for (const seed of [0, 12345, 0x7ffffffe]) {
      const world = new World(seed);
      for (let chunk = -1; chunk < 400; chunk += 3) {
        const mesh = builder.build(world, chunk);
        expect(mesh.vertexCount).toBeLessThanOrEqual(MAX_CHUNK_VERTICES);
        expect(mesh.vertexCount % 4).toBe(0);
        expect(mesh.bytes.byteLength).toBe(mesh.vertexCount * VERTEX_BYTES);
      }
    }
  });

  it("drops faces rather than overflowing a small cap", () => {
    const world = new World(12345);
    for (const cap of [0, 4, 999, 5000]) {
      const builder = new ChunkMeshBuilder(cap);
      for (let chunk = 0; chunk < 20; chunk++) {
        const mesh = builder.build(world, chunk);
        expect(mesh.vertexCount).toBeLessThanOrEqual(cap);
        expect(mesh.vertexCount % 4).toBe(0);
      }
    }
    // Sanity check that the small caps above were actually hit.
    expect(new ChunkMeshBuilder().build(world, 0).vertexCount).toBeGreaterThan(5000);
  });

  it("builds identical geometry for the same seed and chunk", () => {
    const first = new ChunkMeshBuilder(), second = new ChunkMeshBuilder();
    const a = Array.from(first.build(new World(5), 9).bytes);
    expect(Array.from(second.build(new World(5), 9).bytes)).toEqual(a);
  });
});
