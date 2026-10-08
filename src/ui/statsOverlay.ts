import { FrameStatistics, type FrameSample, type FrameSummary } from "./frameStatistics";

/** How often the overlay text refreshes; each refresh summarises the frames since the last one. */
const REFRESH_INTERVAL_MS = 1000;

/** Fixed facts about the device, shown under the live numbers. */
export interface DeviceInfo {
  readonly gpu: string;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
}

/**
 * Performance readout in the top-left corner, shown when the page URL has `?stats` or the user presses
 * "Show stats". It exists only while shown, so a normal ride pays nothing for it.
 */
export class StatsOverlay {
  private readonly element: HTMLPreElement;
  private readonly statistics = new FrameStatistics();

  constructor() {
    this.element = document.createElement("pre");
    this.element.className = "stats";
    this.element.setAttribute("aria-live", "off");
    this.element.textContent = "Measuring…";
    document.body.append(this.element);
  }

  /** Takes the overlay off the page. The instance must not be used afterwards. */
  remove(): void {
    this.element.remove();
  }

  /** Records one frame; refreshes the text about once a second. `device` is read only when refreshing. */
  record(sample: FrameSample, device: () => DeviceInfo): void {
    this.statistics.record(sample);
    if (this.statistics.elapsedMs >= REFRESH_INTERVAL_MS) this.element.textContent = formatSummary(this.statistics.takeSummary(), device());
  }
}

function formatSummary(summary: FrameSummary, device: DeviceInfo): string {
  const ms = (value: number): string => value.toFixed(1);
  const lines = [
    `FPS ${summary.framesPerSecond.toFixed(1)}   frame ${ms(summary.meanIntervalMs)} ms, worst ${ms(summary.worstIntervalMs)}`,
    `CPU ${ms(summary.meanCpuMs)} ms/frame, worst ${ms(summary.worstCpuMs)}`,
    `Draws ${Math.round(summary.meanDrawCalls).toString()}, triangles ${(summary.meanTriangles / 1000).toFixed(0)}k`,
    summary.chunksBuiltPerSecond > 0
      ? `Chunks ${summary.chunksBuiltPerSecond.toFixed(1)}/s, ${ms(summary.meanChunkBuildMs)} ms each, worst ${ms(summary.worstChunkBuildMs)}`
      : "Chunks 0/s",
    `Canvas ${device.canvasWidth.toString()}×${device.canvasHeight.toString()} at ${devicePixelRatio.toString()}x DPR`,
    `GPU ${device.gpu}`,
  ];
  return lines.join("\n");
}
