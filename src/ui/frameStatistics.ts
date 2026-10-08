/** One frame's measurements, as recorded by the frame loop. */
export interface FrameSample {
  /** Time since the previous frame started (requestAnimationFrame timestamps), in ms. */
  readonly intervalMs: number;
  /** Main-thread time spent inside the frame callback, in ms. Excludes GPU time. */
  readonly cpuMs: number;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly chunksBuilt: number;
  /** Main-thread time spent building those chunks, in ms. */
  readonly chunkBuildMs: number;
}

/** Averages and worst cases over a window of frames. */
export interface FrameSummary {
  readonly frames: number;
  readonly framesPerSecond: number;
  readonly meanIntervalMs: number;
  readonly worstIntervalMs: number;
  readonly meanCpuMs: number;
  readonly worstCpuMs: number;
  readonly meanDrawCalls: number;
  readonly meanTriangles: number;
  readonly chunksBuiltPerSecond: number;
  /** Mean and worst build time per chunk, or 0 when no chunk was built in the window. */
  readonly meanChunkBuildMs: number;
  readonly worstChunkBuildMs: number;
}

/** Accumulates {@link FrameSample}s until {@link takeSummary} reads and resets them. */
export class FrameStatistics {
  private frames = 0;
  private totalIntervalMs = 0;
  private worstIntervalMs = 0;
  private totalCpuMs = 0;
  private worstCpuMs = 0;
  private totalDrawCalls = 0;
  private totalTriangles = 0;
  private chunksBuilt = 0;
  private totalChunkBuildMs = 0;
  private worstChunkBuildMs = 0;

  get elapsedMs(): number { return this.totalIntervalMs; }

  record(sample: FrameSample): void {
    this.frames++;
    this.totalIntervalMs += sample.intervalMs;
    this.worstIntervalMs = Math.max(this.worstIntervalMs, sample.intervalMs);
    this.totalCpuMs += sample.cpuMs;
    this.worstCpuMs = Math.max(this.worstCpuMs, sample.cpuMs);
    this.totalDrawCalls += sample.drawCalls;
    this.totalTriangles += sample.triangles;
    if (sample.chunksBuilt > 0) {
      this.chunksBuilt += sample.chunksBuilt;
      this.totalChunkBuildMs += sample.chunkBuildMs;
      this.worstChunkBuildMs = Math.max(this.worstChunkBuildMs, sample.chunkBuildMs / sample.chunksBuilt);
    }
  }

  /** Summarises the frames recorded since the last call, then starts a new window. Needs at least one frame. */
  takeSummary(): FrameSummary {
    const frames = this.frames, seconds = this.totalIntervalMs / 1000;
    const summary: FrameSummary = {
      frames,
      framesPerSecond: seconds > 0 ? frames / seconds : 0,
      meanIntervalMs: this.totalIntervalMs / frames,
      worstIntervalMs: this.worstIntervalMs,
      meanCpuMs: this.totalCpuMs / frames,
      worstCpuMs: this.worstCpuMs,
      meanDrawCalls: this.totalDrawCalls / frames,
      meanTriangles: this.totalTriangles / frames,
      chunksBuiltPerSecond: seconds > 0 ? this.chunksBuilt / seconds : 0,
      meanChunkBuildMs: this.chunksBuilt > 0 ? this.totalChunkBuildMs / this.chunksBuilt : 0,
      worstChunkBuildMs: this.worstChunkBuildMs,
    };
    this.frames = 0;
    this.totalIntervalMs = this.worstIntervalMs = this.totalCpuMs = this.worstCpuMs = 0;
    this.totalDrawCalls = this.totalTriangles = this.chunksBuilt = this.totalChunkBuildMs = this.worstChunkBuildMs = 0;
    return summary;
  }
}
