import { WARP_COUNT, WARPS } from "../world/warps";

function requireElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) throw new Error(`index.html is missing #${id} (expected ${type.name})`);
  return element;
}

/**
 * The on-screen controls: speed, strength, view angle, the manual warp sliders, play/pause, new world and
 * the collapsible panel. Reads its markup from index.html; validates every element it needs on construction.
 */
export class Controls {
  /** Whether the ride is moving. Starts paused when the user prefers reduced motion. */
  playing = !matchMedia("(prefers-reduced-motion: reduce)").matches;

  private readonly speedInput = requireElement("speed", HTMLInputElement);
  private readonly strengthInput = requireElement("strength", HTMLInputElement);
  private readonly fovInput = requireElement("fov", HTMLInputElement);
  private readonly manualInput = requireElement("manual", HTMLInputElement);
  private readonly speedOutput = requireElement("speedOut", HTMLOutputElement);
  private readonly strengthOutput = requireElement("strengthOut", HTMLOutputElement);
  private readonly fovOutput = requireElement("fovOut", HTMLOutputElement);
  private readonly playButton = requireElement("play", HTMLButtonElement);
  private readonly toggleButton = requireElement("toggle", HTMLButtonElement);
  private readonly panel = requireElement("panel", HTMLDivElement);
  private readonly readout = requireElement("readout", HTMLSpanElement);
  private readonly warpInputs: HTMLInputElement[] = [];
  private readonly warpOutputs: HTMLOutputElement[] = [];

  /** @param onNewWorld Called when the user asks for a new world. */
  constructor(onNewWorld: () => void) {
    const warpGroup = requireElement("warps", HTMLDivElement);
    WARPS.forEach(({ name, min, max }, i) => {
      const id = `warp${String(i)}`;
      const label = document.createElement("label");
      label.htmlFor = id;
      label.textContent = name;
      const input = document.createElement("input");
      for (const [attribute, value] of [["id", id], ["type", "range"], ["min", String(min)], ["max", String(max)], ["step", "0.01"], ["value", "0"]])
        input.setAttribute(attribute, value);
      input.disabled = true;
      const output = document.createElement("output");
      output.id = `${id}Out`;
      output.textContent = "0.00";
      warpGroup.append(label, input, output);
      this.warpInputs.push(input);
      this.warpOutputs.push(output);
    });

    for (const input of [this.speedInput, this.strengthInput, this.fovInput, this.manualInput]) input.addEventListener("input", () => { this.syncLabels(); });
    this.playButton.addEventListener("click", () => { this.togglePlay(); });
    requireElement("reseed", HTMLButtonElement).addEventListener("click", onNewWorld);
    this.toggleButton.addEventListener("click", () => { this.togglePanel(); });
    addEventListener("keydown", (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
      if (event.code === "Space") { event.preventDefault(); this.togglePlay(); }
      if (event.code === "KeyH") this.togglePanel();
    });
    if (innerWidth < 560) this.togglePanel();
    this.syncLabels();
  }

  /** Travel speed in blocks per second. */
  get speed(): number { return Number(this.speedInput.value); }
  /** Warp multiplier, 1 at 100%. */
  get strength(): number { return Number(this.strengthInput.value) / 100; }
  get fovDegrees(): number { return Number(this.fovInput.value); }
  /** True when the user sets the warps with the sliders instead of the automatic director. */
  get manualWarps(): boolean { return this.manualInput.checked; }

  /** Writes the manual slider values into `out` ({@link WARP_COUNT} entries). */
  readManualWarps(out: Float32Array): void {
    for (let i = 0; i < WARP_COUNT; i++) out[i] = Number(this.warpInputs[i].value);
  }

  /** Shows the live warp values and distance. In automatic mode the sliders follow the director. */
  showState(liveWarps: Float32Array, travel: number): void {
    for (let i = 0; i < WARP_COUNT; i++) {
      if (!this.manualInput.checked) this.warpInputs[i].value = String(liveWarps[i]);
      this.warpOutputs[i].textContent = liveWarps[i].toFixed(2);
    }
    this.readout.textContent = Math.floor(travel).toLocaleString("en-US") + " m";
  }

  private syncLabels(): void {
    this.speedOutput.textContent = this.speedInput.value + " m/s";
    this.strengthOutput.textContent = this.strengthInput.value + "%";
    this.fovOutput.textContent = this.fovInput.value + "°";
    this.playButton.textContent = this.playing ? "Pause" : "Play";
    for (const input of this.warpInputs) input.disabled = !this.manualInput.checked;
  }

  private togglePlay(): void {
    this.playing = !this.playing;
    this.syncLabels();
  }

  private togglePanel(): void {
    this.panel.hidden = !this.panel.hidden;
    this.toggleButton.textContent = this.panel.hidden ? "Show controls" : "Hide controls";
    this.toggleButton.setAttribute("aria-expanded", String(!this.panel.hidden));
  }
}
