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

test("the ride loads, renders terrain and logs no errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console.error: ${message.text()}`); });
  page.on("pageerror", (error) => { errors.push(`uncaught: ${error.message}`); });
  page.on("requestfailed", (request) => { errors.push(`request failed: ${request.url()} ${request.failure()?.errorText ?? ""}`); });

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
