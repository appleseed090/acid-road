import { expect, test, type Page } from "@playwright/test";

/**
 * Bare sky (a smooth gradient plus grain) quantises to under ten colours; frames with shaded terrain,
 * fog and glowing blocks measured 548 to 1,586 across nine seeds.
 */
const MIN_DISTINCT_COLORS = 200;

/** Decodes a PNG screenshot in the page and counts its distinct colours at 5 bits per channel. */
async function countDistinctColors(page: Page, png: Buffer): Promise<number> {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context");
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, image.width, image.height);
    const colors = new Set<number>();
    for (let i = 0; i < data.length; i += 4) colors.add(((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3));
    return colors.size;
  }, png.toString("base64"));
}

/** Collects console errors, uncaught exceptions and failed requests; every test expects none. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console.error: ${message.text()}`); });
  page.on("pageerror", (error) => { errors.push(`uncaught: ${error.message}`); });
  page.on("requestfailed", (request) => { errors.push(`request failed: ${request.url()} ${request.failure()?.errorText ?? ""}`); });
  return errors;
}

test("the ride loads, renders terrain and logs no errors", async ({ page }) => {
  const errors = collectErrors(page);

  // Pin the world seed (the app's only use of Math.random) so every run rides the same world.
  await page.addInitScript(() => { Math.random = () => 0.3141; });
  await page.goto("./");
  await expect(page).toHaveTitle("Acid Road");
  const readout = page.locator("#readout"), failure = page.locator("#fail");
  // The readout first updates inside the frame loop, so text there means the shaders compiled and frames are running.
  await expect.poll(async () => errors.length > 0 || (await failure.textContent()) !== "" || (await readout.innerText()) !== "", { timeout: 30_000 })
    .toBe(true);
  expect(errors).toEqual([]);
  await expect(failure).toBeHidden();
  await expect.poll(async () => Number((await readout.innerText()).replace(/[^0-9]/g, "")), { timeout: 30_000 }).toBeGreaterThan(0);

  await page.addStyleTag({ content: ".hud { visibility: hidden; }" });
  const distinctColors = await countDistinctColors(page, await page.locator("#view").screenshot());
  test.info().annotations.push({ type: "distinct colours", description: String(distinctColors) });
  expect(distinctColors, "canvas looks blank or sky-only").toBeGreaterThan(MIN_DISTINCT_COLORS);

  expect(errors).toEqual([]);
});

test("?seed and ?at open a given world at a given distance, and the URL names the world", async ({ page }) => {
  const errors = collectErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" }); // starts paused, so the distance stays put
  await page.goto("./?seed=4242&at=5000");
  await expect(page.locator("#readout")).toHaveText("5,000 m", { timeout: 30_000 });
  expect(new URL(page.url()).search).toBe("?seed=4242&at=5000");

  await page.locator("#reseed").click();
  await expect(page.locator("#readout")).toHaveText("0 m");
  const search = new URL(page.url()).searchParams;
  expect(search.get("seed")).toMatch(/^\d+$/);
  expect(search.get("seed")).not.toBe("4242");
  expect(search.has("at")).toBe(false);
  expect(errors).toEqual([]);
});

test("?stats shows the performance overlay; without it there is none", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("./?stats");
  await expect(page.locator(".stats")).toContainText(/^FPS \d/, { timeout: 30_000 });
  await expect(page.locator(".stats")).toContainText("GPU ");
  await expect(page.locator("#statsToggle")).toHaveText("Hide stats");
  expect(new URL(page.url()).search).toMatch(/^\?stats&seed=\d+$/);

  await page.goto("./");
  await expect(page.locator("#readout")).not.toHaveText("", { timeout: 30_000 });
  await expect(page.locator(".stats")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Hide controls hides the panel, and Show controls brings it back", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("./");
  const panel = page.locator("#panel"), toggle = page.locator("#toggle");
  await expect(panel).toBeVisible({ timeout: 30_000 });
  await toggle.click();
  await expect(panel).toBeHidden();
  await expect(toggle).toHaveText("Show controls");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(panel).toBeVisible();
  await expect(toggle).toHaveText("Hide controls");
  expect(errors).toEqual([]);
});

test("Show stats and Hide stats toggle the overlay and the ?stats flag", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("./?seed=4242");
  const button = page.locator("#statsToggle"), overlay = page.locator(".stats");
  await expect(button).toHaveText("Show stats", { timeout: 30_000 });
  await expect(overlay).toHaveCount(0);

  await button.click();
  await expect(overlay).toContainText(/^FPS \d/, { timeout: 30_000 });
  await expect(button).toHaveText("Hide stats");
  await expect(button).toHaveAttribute("aria-pressed", "true");
  expect(new URL(page.url()).search).toBe("?seed=4242&stats");

  await button.click();
  await expect(overlay).toHaveCount(0);
  await expect(button).toHaveText("Show stats");
  expect(new URL(page.url()).search).toBe("?seed=4242");
  expect(errors).toEqual([]);
});
