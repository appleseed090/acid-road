import { biomeColor, BiomeColor, BiomeNumber, columnHeight, isRoadColumn, type Biome } from "./biomes";
import { mixed, scaled, type Rgb } from "./color";
import { CHUNK_LENGTH, COLUMNS_X, HALF_WIDTH } from "./constants";
import { hash3 } from "./random";
import type { World } from "./world";

/**
 * Bytes per vertex. Layout: position as 3 x float32 (offset 0), colour as 4 x uint8 where the fourth byte is
 * emissive strength (offset 12), normal as 3 x int8 (offset 16), 1 byte of padding.
 */
export const VERTEX_BYTES = 20;
/** Default vertex budget per chunk. Faces that would exceed it are dropped, never truncated mid-quad. */
export const MAX_CHUNK_VERTICES = 200000;

/** One chunk's vertices. Every four consecutive vertices form a quad (0, 1, 2) + (0, 2, 3). */
export interface ChunkMesh {
  /** View into the builder's scratch buffer: valid only until the builder's next {@link ChunkMeshBuilder.build}. */
  readonly bytes: Uint8Array;
  readonly vertexCount: number;
}

/**
 * Builds chunk geometry into a reusable scratch buffer. Positions are chunk-local in z (0 to CHUNK_LENGTH)
 * so they stay small however far the ride goes; the renderer adds the chunk offset.
 */
export class ChunkMeshBuilder {
  private readonly floats: Float32Array;
  private readonly bytes: Uint8Array;
  private readonly signedBytes: Int8Array;
  private readonly heights = new Float32Array((CHUNK_LENGTH + 2) * (COLUMNS_X + 2));
  private vertexCount = 0;

  /** @param maxVertices Vertex cap per chunk; the renderer sizes its shared index buffer from this. */
  constructor(readonly maxVertices: number = MAX_CHUNK_VERTICES) {
    const scratch = new ArrayBuffer(maxVertices * VERTEX_BYTES);
    this.floats = new Float32Array(scratch);
    this.bytes = new Uint8Array(scratch);
    this.signedBytes = new Int8Array(scratch);
  }

  /** Builds chunk `chunkIndex`, which covers road positions [chunkIndex * CHUNK_LENGTH, (chunkIndex + 1) * CHUNK_LENGTH). */
  build(world: World, chunkIndex: number): ChunkMesh {
    this.vertexCount = 0;
    const seed = world.seed;
    const z0 = chunkIndex * CHUNK_LENGTH, rowBiomes: Biome[] = [];
    for (let row = -1; row <= CHUNK_LENGTH; row++) {
      const biome = world.biomes.at(z0 + row);
      rowBiomes.push(biome);
      for (let column = -1; column <= COLUMNS_X; column++)
        this.heights[(row + 1) * (COLUMNS_X + 2) + column + 1] = columnHeight(seed, column - HALF_WIDTH, z0 + row, biome);
    }
    for (let row = 0; row < CHUNK_LENGTH; row++) {
      const z = z0 + row, biome = rowBiomes[row + 1], n = biome.numbers;
      const low = biomeColor(biome, BiomeColor.LOW), mid = biomeColor(biome, BiomeColor.MID), high = biomeColor(biome, BiomeColor.HIGH);
      const accent = biomeColor(biome, BiomeColor.ACCENT), accent2 = biomeColor(biome, BiomeColor.ACCENT2);
      const road = biomeColor(biome, BiomeColor.ROAD), lamp = biomeColor(biome, BiomeColor.LAMP);
      const heightScale = n[BiomeNumber.AMP_LOW] * 0.8 + n[BiomeNumber.AMP_HIGH] + 6;
      for (let column = 0; column < COLUMNS_X; column++) {
        const x = column - HALF_WIDTH, lateral = Math.abs(x + 0.5), h = this.heightAt(column, row);
        let color: Rgb, emissive = 0;
        if (isRoadColumn(x)) {
          const stripe = lateral < 1 && (Math.floor(z / 3) % 4) === 0;
          color = stripe ? lamp : scaled(road, 0.9 + 0.2 * hash3(seed, x, z, 5));
          emissive = stripe ? 160 : 0;
        } else {
          const t = Math.min(1, h / heightScale);
          color = scaled(t < 0.5 ? mixed(low, mid, t * 2) : mixed(mid, high, t * 2 - 1), 0.9 + 0.2 * hash3(seed, x, z, 5));
        }
        this.pushRectangle(x, h, row, 1, 0, 0, 0, 0, 1, 1, 1, 0, 127, 0, color, emissive);
        const west = this.heightAt(column - 1, row), east = this.heightAt(column + 1, row);
        const south = this.heightAt(column, row - 1), north = this.heightAt(column, row + 1);
        if (west < h) this.pushRectangle(x, west, row, 0, 0, 1, 0, h - west, 0, 1, 1, -127, 0, 0, color, 0);
        if (east < h) this.pushRectangle(x + 1, east, row, 0, 0, 1, 0, h - east, 0, 1, 1, 127, 0, 0, color, 0);
        if (south < h) this.pushRectangle(x, south, row, 1, 0, 0, 0, h - south, 0, 1, 1, 0, 0, -127, color, 0);
        if (north < h) this.pushRectangle(x, north, row + 1, 1, 0, 0, 0, h - north, 0, 1, 1, 0, 0, 127, color, 0);

        if (lateral < 7) continue;
        const chance = hash3(seed, x, z, 6), variety = hash3(seed, x, z, 7);
        if (chance < n[BiomeNumber.PILLARS]) {
          const top = h + 10 + variety * 30;
          this.pushBox(x, h, row, x + 2, top, row + 2, scaled(accent, 0.55), 0);
          this.pushBox(x, top, row, x + 2, top + 1, row + 2, accent2, 255);
        } else if (chance < n[BiomeNumber.PILLARS] + n[BiomeNumber.FLOATERS]) {
          const size = 2 + Math.floor(variety * 3), y = h + 8 + hash3(seed, x, z, 8) * 26;
          this.pushBox(x, y, row, x + size, y + size, row + size, accent2, variety < 0.35 ? 230 : 0);
        } else if (h > 0 && chance < n[BiomeNumber.PILLARS] + n[BiomeNumber.FLOATERS] + n[BiomeNumber.TREES]) {
          const trunk = 3 + Math.floor(variety * 4);
          this.pushBox(x, h, row, x + 1, h + trunk, row + 1, scaled(road, 1.6), 0);
          this.pushBox(x - 1, h + trunk, row - 1, x + 2, h + trunk + 3, row + 2, scaled(accent, 0.8 + 0.3 * variety), 0);
        }
      }
      if (z % 24 === 0) for (const side of [-5, 4]) {
        const ground = this.heightAt(side + HALF_WIDTH, row);
        this.pushBox(side, ground, row, side + 1, ground + 3, row + 1, scaled(road, 0.7), 0);
        this.pushBox(side, ground + 3, row, side + 1, ground + 4, row + 1, lamp, 255);
      }
      if (biome.gateSpacing !== 0 && z % biome.gateSpacing === 0) {
        const half = 6 + Math.floor(hash3(seed, z, 1, 10) * biome.gateSize), tall = 8 + Math.floor(hash3(seed, z, 2, 10) * biome.gateSize * 0.7);
        const color = biome.gateGlows ? accent : scaled(road, 2.2), glow = biome.gateGlows ? 255 : 0;
        this.pushBox(-half - 2, 0, row, -half, tall, row + 2, color, glow);
        this.pushBox(half, 0, row, half + 2, tall, row + 2, color, glow);
        this.pushBox(-half - 2, tall, row, half + 2, tall + 2, row + 2, color, glow);
      }
    }
    return { bytes: this.bytes.subarray(0, this.vertexCount * VERTEX_BYTES), vertexCount: this.vertexCount };
  }

  /** Height of `column` in `row`, where both may be one step outside the chunk (-1 or one past the end). */
  private heightAt(column: number, row: number): number {
    return this.heights[(row + 1) * (COLUMNS_X + 2) + column + 1];
  }

  private pushVertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, r: number, g: number, b: number, emissive: number): void {
    const f = this.vertexCount * 5, o = this.vertexCount * VERTEX_BYTES;
    this.floats[f] = x; this.floats[f + 1] = y; this.floats[f + 2] = z;
    this.bytes[o + 12] = r; this.bytes[o + 13] = g; this.bytes[o + 14] = b; this.bytes[o + 15] = emissive;
    this.signedBytes[o + 16] = nx; this.signedBytes[o + 17] = ny; this.signedBytes[o + 18] = nz;
    this.vertexCount++;
  }

  /** Emits a flat rectangle split into stepsU x stepsV quads, so long faces still have vertices to bend. */
  private pushRectangle(
    ox: number, oy: number, oz: number, ux: number, uy: number, uz: number, vx: number, vy: number, vz: number,
    stepsU: number, stepsV: number, nx: number, ny: number, nz: number, color: Rgb, emissive: number,
  ): void {
    if (this.vertexCount + stepsU * stepsV * 4 > this.maxVertices) return;
    const r = Math.min(255, color[0] * 255), g = Math.min(255, color[1] * 255), b = Math.min(255, color[2] * 255);
    for (let i = 0; i < stepsU; i++) for (let j = 0; j < stepsV; j++) {
      const u0 = i / stepsU, u1 = (i + 1) / stepsU, v0 = j / stepsV, v1 = (j + 1) / stepsV;
      this.pushVertex(ox + ux * u0 + vx * v0, oy + uy * u0 + vy * v0, oz + uz * u0 + vz * v0, nx, ny, nz, r, g, b, emissive);
      this.pushVertex(ox + ux * u1 + vx * v0, oy + uy * u1 + vy * v0, oz + uz * u1 + vz * v0, nx, ny, nz, r, g, b, emissive);
      this.pushVertex(ox + ux * u1 + vx * v1, oy + uy * u1 + vy * v1, oz + uz * u1 + vz * v1, nx, ny, nz, r, g, b, emissive);
      this.pushVertex(ox + ux * u0 + vx * v1, oy + uy * u0 + vy * v1, oz + uz * u0 + vz * v1, nx, ny, nz, r, g, b, emissive);
    }
  }

  private pushBox(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: Rgb, emissive: number): void {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0, sx = Math.ceil(w / 2), sz = Math.ceil(d / 2);
    this.pushRectangle(x0, y1, z0, w, 0, 0, 0, 0, d, sx, sz, 0, 127, 0, color, emissive);
    this.pushRectangle(x0, y0, z0, w, 0, 0, 0, 0, d, sx, sz, 0, -127, 0, color, emissive);
    this.pushRectangle(x0, y0, z0, w, 0, 0, 0, h, 0, sx, 1, 0, 0, -127, color, emissive);
    this.pushRectangle(x0, y0, z1, w, 0, 0, 0, h, 0, sx, 1, 0, 0, 127, color, emissive);
    this.pushRectangle(x0, y0, z0, 0, 0, d, 0, h, 0, sz, 1, -127, 0, 0, color, emissive);
    this.pushRectangle(x1, y0, z0, 0, 0, d, 0, h, 0, sz, 1, 127, 0, 0, color, emissive);
  }
}
