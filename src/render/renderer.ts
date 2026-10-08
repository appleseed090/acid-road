import { CHUNK_COUNT, CHUNK_LENGTH, CHUNKS_BEHIND, EYE_HEIGHT, FOG_END, HALF_WIDTH, WAVE_FREQUENCY } from "../world/constants";
import type { Rgb } from "../world/color";
import { VERTEX_BYTES, type ChunkMeshBuilder } from "../world/chunkMesh";
import { smoothstep } from "../world/random";
import { Warp } from "../world/warps";
import type { World } from "../world/world";
import { projectionMatrix } from "./projection";
import {
  SKY_FRAGMENT_SHADER, SKY_UNIFORMS, SKY_VERTEX_SHADER, TERRAIN_FRAGMENT_SHADER, TERRAIN_UNIFORMS, TERRAIN_VERTEX_SHADER,
} from "./shaders";

/** Everything that changes per frame. */
export interface FrameState {
  /** Distance travelled along the road, in blocks. Kept as a double; never sent to the GPU directly. */
  readonly travel: number;
  /** Current warp values in {@link WARPS} order, before the strength multiplier. */
  readonly warps: Float32Array;
  /** Overall warp multiplier; 1 is the designed strength. Does not scale Ceiling. */
  readonly strength: number;
  readonly fovDegrees: number;
  readonly fogColor: Rgb;
  readonly zenithColor: Rgb;
  /** Overall light level of lit (non-emissive) surfaces. */
  readonly light: number;
}

/** What one {@link Renderer.draw} call submitted to the GPU. */
export interface DrawStats {
  readonly drawCalls: number;
  readonly triangles: number;
}

export type RendererResult =
  | { readonly ok: true; readonly renderer: Renderer }
  | { readonly ok: false; readonly reason: "no-webgl2" | "shader-error"; readonly error?: Error };

interface Program<Name extends string> {
  readonly program: WebGLProgram;
  readonly uniforms: Readonly<Record<Name, WebGLUniformLocation | null>>;
}

interface ChunkSlot {
  readonly vertexArray: WebGLVertexArrayObject;
  readonly buffer: WebGLBuffer;
  /** Which chunk this slot currently holds, or null when free. */
  chunkIndex: number | null;
  indexCount: number;
}

/** Thrown when a shader fails to compile or link; the message carries the driver's info log. */
export class ShaderError extends Error {
  override name = "ShaderError";
}

function compileProgram<Name extends string>(
  gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string, uniformNames: readonly Name[],
): Program<Name> {
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
    const shader = gl.createShader(type);
    if (!shader) throw new ShaderError("Could not create a shader object (is the WebGL context lost?)");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new ShaderError("Shader failed to compile: " + String(gl.getShaderInfoLog(shader)));
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new ShaderError("Shader failed to link: " + String(gl.getProgramInfoLog(program)));
  // A uniform the driver optimised away resolves to null, and setting a null location is a harmless no-op.
  const uniforms = Object.fromEntries(uniformNames.map((name) => [name, gl.getUniformLocation(program, name)])) as Record<Name, WebGLUniformLocation | null>;
  return { program, uniforms };
}

function setRgb(gl: WebGL2RenderingContext, location: WebGLUniformLocation | null, color: Rgb): void {
  gl.uniform3f(location, color[0], color[1], color[2]);
}

/**
 * Owns the WebGL2 context: the recycled chunk slots, the shared quad index buffer and both shader programs.
 * The world itself is static; all warping happens in the terrain vertex shader.
 */
export class Renderer {
  private readonly chunks: ChunkSlot[] = [];
  private readonly skyVertexArray: WebGLVertexArrayObject;

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
    private readonly terrain: Program<(typeof TERRAIN_UNIFORMS)[number]>,
    private readonly sky: Program<(typeof SKY_UNIFORMS)[number]>,
    private readonly meshBuilder: ChunkMeshBuilder,
  ) {
    // Every face is a quad, so all chunks share one index pattern.
    const quadIndices = new Uint32Array(meshBuilder.maxVertices / 4 * 6);
    for (let q = 0, i = 0; i < quadIndices.length; q += 4, i += 6) quadIndices.set([q, q + 1, q + 2, q, q + 2, q + 3], i);
    const indexBuffer = gl.createBuffer();
    this.skyVertexArray = gl.createVertexArray();
    for (let i = 0; i < CHUNK_COUNT; i++) {
      const vertexArray = gl.createVertexArray(), buffer = gl.createBuffer();
      gl.bindVertexArray(vertexArray);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      if (i === 0) gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, quadIndices, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, VERTEX_BYTES, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, VERTEX_BYTES, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.BYTE, true, VERTEX_BYTES, 16);
      this.chunks.push({ vertexArray, buffer, chunkIndex: null, indexCount: 0 });
    }
    gl.bindVertexArray(null);
  }

  /** Creates the context and compiles the shaders. Returns a failure instead of throwing. */
  static create(canvas: HTMLCanvasElement, meshBuilder: ChunkMeshBuilder): RendererResult {
    const gl = canvas.getContext("webgl2", { antialias: true, powerPreference: "high-performance" });
    if (!gl) return { ok: false, reason: "no-webgl2" };
    try {
      const terrain = compileProgram(gl, TERRAIN_VERTEX_SHADER, TERRAIN_FRAGMENT_SHADER, TERRAIN_UNIFORMS);
      const sky = compileProgram(gl, SKY_VERTEX_SHADER, SKY_FRAGMENT_SHADER, SKY_UNIFORMS);
      return { ok: true, renderer: new Renderer(canvas, gl, terrain, sky, meshBuilder) };
    } catch (error) {
      if (error instanceof ShaderError) return { ok: false, reason: "shader-error", error };
      throw error;
    }
  }

  /** Forgets every loaded chunk, for when the world changes. The next {@link streamChunks} rebuilds them. */
  clearChunks(): void {
    for (const chunk of this.chunks) chunk.chunkIndex = null;
  }

  /**
   * Recycles chunks that fell behind `travel` into the nearest missing slots ahead. Builds at most `budget`
   * chunks, nearest first, so a few per frame avoids hitches. Returns how many it built.
   */
  streamChunks(world: World, travel: number, budget: number): number {
    const first = Math.floor(travel / CHUNK_LENGTH) - CHUNKS_BEHIND, last = first + CHUNK_COUNT - 1;
    const present = new Set<number>(), free: ChunkSlot[] = [];
    for (const chunk of this.chunks) {
      if (chunk.chunkIndex !== null && chunk.chunkIndex >= first && chunk.chunkIndex <= last) present.add(chunk.chunkIndex);
      else free.push(chunk);
    }
    let built = 0;
    for (let index = first; index <= last && built < budget; index++) {
      if (present.has(index)) continue;
      const slot = free.pop();
      if (!slot) break;
      this.loadChunk(world, slot, index);
      built++;
    }
    return built;
  }

  /**
   * The GPU and driver as the browser reports them, for the stats overlay. Browsers may mask or round this,
   * and software rendering shows up here (for example "SwiftShader").
   */
  describeGpu(): string {
    const { gl } = this;
    const renderer = String(gl.getParameter(gl.RENDERER));
    // Chrome and Safari report a generic name unless asked through the debug extension; Firefox reports the
    // real (sanitised) name directly and warns that the extension is deprecated, so only ask when needed.
    if (renderer !== "WebKit WebGL") return renderer;
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    return debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : renderer;
  }

  draw(frame: FrameState): DrawStats {
    const { gl } = this;
    this.resize();
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.sky.program);
    const s = this.sky.uniforms;
    gl.uniform2f(s.uResolution, this.canvas.width, this.canvas.height);
    setRgb(gl, s.uFogColor, frame.fogColor); setRgb(gl, s.uZenithColor, frame.zenithColor);
    gl.bindVertexArray(this.skyVertexArray); gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.DEPTH_TEST); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.terrain.program);
    const u = this.terrain.uniforms, warps = frame.warps, strength = frame.strength;
    gl.uniformMatrix4fv(u.uProjection, false, projectionMatrix(frame.fovDegrees, this.canvas.width / this.canvas.height));
    gl.uniform1f(u.uEyeHeight, EYE_HEIGHT); gl.uniform1f(u.uHalfWidth, HALF_WIDTH); gl.uniform1f(u.uFogEnd, FOG_END);
    gl.uniform1f(u.uWavePhase, (frame.travel * WAVE_FREQUENCY) % (Math.PI * 2)); // keeps the waves fixed to the ground, not the camera
    gl.uniform1f(u.uCeilingY, 260 + (46 - 260) * warps[Warp.CEILING]);
    setRgb(gl, u.uFogColor, frame.fogColor); gl.uniform1f(u.uLight, frame.light);
    gl.uniform1f(u.uTwist, warps[Warp.TWIST] * strength); gl.uniform1f(u.uRoll, warps[Warp.ROLL] * strength);
    gl.uniform1f(u.uRise, warps[Warp.RISE] * strength); gl.uniform1f(u.uSwerve, warps[Warp.SWERVE] * strength);
    gl.uniform1f(u.uWave, warps[Warp.WAVES] * strength); gl.uniform1f(u.uStretch, warps[Warp.STRETCH] * strength);
    gl.uniform1f(u.uPinch, warps[Warp.PINCH] * strength);
    let terrain = this.drawTerrain(frame, false);
    if (warps[Warp.CEILING] > 0.01) {
      const mirrored = this.drawTerrain(frame, true);
      terrain = { drawCalls: terrain.drawCalls + mirrored.drawCalls, triangles: terrain.triangles + mirrored.triangles };
    }
    return { drawCalls: terrain.drawCalls + 1, triangles: terrain.triangles + 1 };
  }

  private loadChunk(world: World, slot: ChunkSlot, chunkIndex: number): void {
    const { gl } = this;
    const mesh = this.meshBuilder.build(world, chunkIndex);
    gl.bindBuffer(gl.ARRAY_BUFFER, slot.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.bytes, gl.DYNAMIC_DRAW);
    slot.chunkIndex = chunkIndex;
    slot.indexCount = mesh.vertexCount / 4 * 6;
  }

  private resize(): void {
    const { canvas } = this;
    const scale = Math.min(devicePixelRatio || 1, 2), width = Math.round(canvas.clientWidth * scale), height = Math.round(canvas.clientHeight * scale);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    this.gl.viewport(0, 0, width, height);
  }

  /** Draws every loaded chunk. Frustum culling is off on purpose: warped geometry does not match its unwarped bounds. */
  private drawTerrain(frame: FrameState, mirror: boolean): DrawStats {
    const { gl } = this, u = this.terrain.uniforms;
    gl.uniform1f(u.uMirror, mirror ? 1 : 0);
    gl.uniform1f(u.uMirrorFade, mirror ? 1 - smoothstep(0, 0.35, frame.warps[Warp.CEILING]) : 0);
    let drawCalls = 0, triangles = 0;
    for (const chunk of this.chunks) {
      if (chunk.chunkIndex === null) continue;
      // Subtracted in doubles on the CPU, so there is no float drift however far the ride goes.
      gl.uniform1f(u.uChunkZ, chunk.chunkIndex * CHUNK_LENGTH - frame.travel);
      gl.bindVertexArray(chunk.vertexArray);
      gl.drawElements(gl.TRIANGLES, chunk.indexCount, gl.UNSIGNED_INT, 0);
      drawCalls++;
      triangles += chunk.indexCount / 3;
    }
    return { drawCalls, triangles };
  }
}
