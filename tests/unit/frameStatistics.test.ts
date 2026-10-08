import { describe, expect, it } from "vitest";
import { FrameStatistics, type FrameSample } from "../../src/ui/frameStatistics";

const sample = (overrides: Partial<FrameSample>): FrameSample =>
  ({ intervalMs: 20, cpuMs: 5, drawCalls: 26, triangles: 300_000, chunksBuilt: 0, chunkBuildMs: 0, ...overrides });

describe("FrameStatistics", () => {
  it("summarises means, worst cases and rates over the window", () => {
    const statistics = new FrameStatistics();
    statistics.record(sample({ intervalMs: 10, cpuMs: 2, chunksBuilt: 2, chunkBuildMs: 30 }));
    statistics.record(sample({ intervalMs: 30, cpuMs: 8, drawCalls: 51, triangles: 600_000 }));
    statistics.record(sample({ intervalMs: 20, cpuMs: 5, chunksBuilt: 1, chunkBuildMs: 25 }));
    expect(statistics.elapsedMs).toBe(60);
    const summary = statistics.takeSummary();
    expect(summary.frames).toBe(3);
    expect(summary.framesPerSecond).toBeCloseTo(50);
    expect(summary.meanIntervalMs).toBeCloseTo(20);
    expect(summary.worstIntervalMs).toBe(30);
    expect(summary.meanCpuMs).toBeCloseTo(5);
    expect(summary.worstCpuMs).toBe(8);
    expect(summary.meanDrawCalls).toBeCloseTo(103 / 3);
    expect(summary.meanTriangles).toBeCloseTo(400_000);
    expect(summary.chunksBuiltPerSecond).toBeCloseTo(50);
    expect(summary.meanChunkBuildMs).toBeCloseTo(55 / 3);
    expect(summary.worstChunkBuildMs).toBe(25);
  });

  it("starts a fresh window after each summary", () => {
    const statistics = new FrameStatistics();
    statistics.record(sample({ intervalMs: 100, chunksBuilt: 1, chunkBuildMs: 40 }));
    statistics.takeSummary();
    statistics.record(sample({ intervalMs: 16 }));
    expect(statistics.elapsedMs).toBe(16);
    const summary = statistics.takeSummary();
    expect(summary).toMatchObject({ frames: 1, worstIntervalMs: 16, chunksBuiltPerSecond: 0, meanChunkBuildMs: 0, worstChunkBuildMs: 0 });
  });
});
