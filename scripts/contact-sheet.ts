/**
 * Renders still frames along long rides and lays them out on one HTML page, to review how the automatic warp
 * sequence looks over distance without riding it in real time.
 *
 *   npm run build && npm run contact-sheet -- --seeds 4242,12345 --step 210 --count 60
 *
 * Options (all optional): --seeds (comma-separated), --step (metres between frames), --count (frames per
 * seed), --out (directory, default contact-sheet/), --width and --height (frame size in CSS pixels).
 * Serves dist/ with `vite preview` on port 4174 while it runs. Needs Node 22.18 or newer (type stripping).
 * Fails if the page logs any console error.
 */
import { chromium, type Page } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

const PORT = 4174;
const BASE_URL = `http://localhost:${String(PORT)}/acid-road/`;
const LIVE_URL = "https://appleseed090.github.io/acid-road/";
const WARP_NAMES = ["Twist", "Roll", "Rise", "Swerve", "Waves", "Stretch", "Pinch", "Ceiling"];

interface Frame {
  readonly seed: number;
  readonly distance: number;
  readonly file: string;
  /** Live warp values as the page displays them, in WARP_NAMES order. */
  readonly warps: readonly number[];
}

function positiveInteger(text: string, name: string): number {
  const value = Number(text);
  if (!/^\d+$/.test(text) || value <= 0) throw new Error(`--${name} must be a positive whole number, got "${text}"`);
  return value;
}

function readOptions() {
  const { values } = parseArgs({
    options: {
      seeds: { type: "string", default: "4242,12345,777,2026" },
      step: { type: "string", default: "210" },
      count: { type: "string", default: "60" },
      out: { type: "string", default: "contact-sheet" },
      width: { type: "string", default: "640" },
      height: { type: "string", default: "360" },
    },
  });
  const seeds = values.seeds.split(",").map((seed) => {
    if (!/^\d+$/.test(seed) || Number(seed) > 0x7fffffff) throw new Error(`--seeds must be whole numbers from 0 to 2147483647, got "${seed}"`);
    return Number(seed);
  });
  return {
    seeds,
    step: positiveInteger(values.step, "step"),
    count: positiveInteger(values.count, "count"),
    out: values.out,
    width: positiveInteger(values.width, "width"),
    height: positiveInteger(values.height, "height"),
  };
}

async function waitForServer(url: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`vite preview did not start on ${url}; run npm run build first`);
}

async function captureFrame(page: Page, seed: number, distance: number, path: string): Promise<readonly number[]> {
  await page.goto(`${BASE_URL}?seed=${String(seed)}&at=${String(distance)}`);
  await page.locator("#readout").filter({ hasText: / m$/ }).waitFor({ timeout: 60_000 });
  // The readout first updates inside a frame; wait one more so the drawn frame is complete.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const warps = await page.evaluate((count) =>
    Array.from({ length: count }, (_, i) => Number(document.getElementById(`warp${String(i)}Out`)?.textContent)), WARP_NAMES.length);
  await page.addStyleTag({ content: ".hud { visibility: hidden; }" });
  await page.screenshot({ path, type: "jpeg", quality: 72 });
  return warps;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (character) => `&#${String(character.charCodeAt(0))};`);
}

function renderPage(frames: readonly Frame[], seeds: readonly number[], step: number): string {
  const sections = seeds.map((seed) => {
    const figures = frames.filter((frame) => frame.seed === seed).map((frame) => {
      const active = frame.warps.flatMap((value, i) => Math.abs(value) >= 0.05 ? [`${WARP_NAMES[i] ?? "?"} ${value.toFixed(2)}`] : []);
      const link = `${LIVE_URL}?seed=${String(seed)}&at=${String(frame.distance)}`;
      return `<figure><a href="${escapeHtml(link)}"><img src="${escapeHtml(frame.file)}" alt="Seed ${String(seed)} at ${String(frame.distance)} m" loading="lazy"></a>
<figcaption><b>${frame.distance.toLocaleString("en-US")} m</b> ${escapeHtml(active.length > 0 ? active.join(", ") : "calm")}</figcaption></figure>`;
    });
    return `<section><h2>Seed ${String(seed)}</h2><div class="grid">${figures.join("\n")}</div></section>`;
  });
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Acid Road contact sheet</title>
<style>
body { margin: 0; padding: 16px; background: #0b0a14; color: #f1eeff; font: 13px/1.4 ui-monospace, Menlo, monospace; }
h1 { font-size: 18px; } h2 { font-size: 15px; margin: 24px 0 8px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
figure { margin: 0; } img { width: 100%; display: block; border-radius: 3px; }
figcaption { color: #a9a2cf; margin-top: 4px; } figcaption b { color: #ffc93c; font-weight: 500; }
</style></head><body>
<h1>Acid Road contact sheet</h1>
<p>A frame every ${String(step)} m. Captions list warps at 0.05 or more. Click a frame to open that point live.</p>
${sections.join("\n")}
</body></html>
`;
}

async function main(): Promise<void> {
  const options = readOptions();
  const framesDirectory = join(options.out, "frames");
  await rm(options.out, { recursive: true, force: true });
  await mkdir(framesDirectory, { recursive: true });

  // Its own process group, so stopping it also stops the vite process that npx starts.
  const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
  const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
  try {
    await waitForServer(BASE_URL);
    const context = await browser.newContext({ viewport: { width: options.width, height: options.height }, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => { errors.push(error.message); });

    const frames: Frame[] = [];
    for (const seed of options.seeds) {
      for (let n = 0; n < options.count; n++) {
        const distance = n * options.step, file = `frames/${String(seed)}-${String(distance)}.jpg`;
        const warps = await captureFrame(page, seed, distance, join(options.out, file));
        frames.push({ seed, distance, file, warps });
        process.stdout.write(`\rseed ${String(seed)}: ${String(n + 1)}/${String(options.count)}`);
      }
      process.stdout.write("\n");
    }
    if (errors.length > 0) throw new Error(`The page logged errors:\n${errors.join("\n")}`);
    await writeFile(join(options.out, "frames.json"), JSON.stringify(frames, null, 1));
    await writeFile(join(options.out, "index.html"), renderPage(frames, options.seeds, options.step));
    console.log(`Wrote ${String(frames.length)} frames to ${join(options.out, "index.html")}`);
  } finally {
    await browser.close();
    if (server.pid !== undefined) process.kill(-server.pid);
  }
}

await main();
