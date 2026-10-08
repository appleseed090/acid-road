/**
 * Ride options read from the page URL:
 * - `seed`: world seed, an integer from 0 to 2147483647. Missing or invalid means a random world.
 * - `at`: distance in metres to start the ride at, a non-negative number. Missing or invalid means 0.
 * - `stats`: present (any value) to show the performance overlay.
 */
export interface RideParams {
  readonly seed: number | null;
  readonly startTravel: number;
  readonly showStats: boolean;
  /** One message per parameter that was present but invalid and therefore ignored. */
  readonly problems: readonly string[];
}

export const MAX_SEED = 0x7fffffff;

const SEED_PATTERN = /^\d{1,10}$/;
const DISTANCE_PATTERN = /^\d{1,15}(\.\d+)?$/;

export function parseRideParams(search: string): RideParams {
  const params = new URLSearchParams(search), problems: string[] = [];
  let seed: number | null = null, startTravel = 0;

  const seedText = params.get("seed");
  if (seedText !== null) {
    const value = Number(seedText);
    if (SEED_PATTERN.test(seedText) && value <= MAX_SEED) seed = value;
    else problems.push(`Ignoring seed=${seedText}: expected a whole number from 0 to ${String(MAX_SEED)}.`);
  }

  const atText = params.get("at");
  if (atText !== null) {
    if (DISTANCE_PATTERN.test(atText)) startTravel = Number(atText);
    else problems.push(`Ignoring at=${atText}: expected a distance in metres, such as 1200.`);
  }

  return { seed, startTravel, showStats: params.has("stats"), problems };
}

/**
 * The shareable URL for a ride: `href` with `seed` set and `at` set to `startTravel`, or removed when it is 0.
 * Other parameters, such as `stats`, are kept.
 */
export function urlForRide(href: string, seed: number, startTravel: number): string {
  const url = new URL(href);
  url.searchParams.set("seed", String(seed));
  if (startTravel > 0) url.searchParams.set("at", String(startTravel));
  else url.searchParams.delete("at");
  return tidyUrl(url);
}

/** `href` with the bare flag `name` (such as `stats`) added when `on`, removed otherwise. */
export function urlWithFlag(href: string, name: string, on: boolean): string {
  const url = new URL(href);
  if (on) { if (!url.searchParams.has(name)) url.searchParams.append(name, ""); }
  else url.searchParams.delete(name);
  return tidyUrl(url);
}

/** URLSearchParams writes a bare flag like `stats` back as `stats=`; keep flags bare so links stay tidy. */
function tidyUrl(url: URL): string {
  url.search = [...url.searchParams].map(([key, value]) => value === "" ? encodeURIComponent(key) : `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
  return url.toString();
}
