import { describe, expect, it } from "vitest";
import { MAX_SEED, parseRideParams, urlForRide } from "../../src/ui/rideParams";

describe("parseRideParams", () => {
  it("defaults to a random world from the start, without stats", () => {
    expect(parseRideParams("")).toEqual({ seed: null, startTravel: 0, showStats: false, problems: [] });
  });

  it("reads seed, at and stats", () => {
    expect(parseRideParams("?seed=12345&at=4200.5&stats")).toEqual({ seed: 12345, startTravel: 4200.5, showStats: true, problems: [] });
    expect(parseRideParams(`?seed=0&stats=1`)).toMatchObject({ seed: 0, showStats: true });
    expect(parseRideParams(`?seed=${String(MAX_SEED)}`).seed).toBe(MAX_SEED);
  });

  it("ignores invalid values and says why", () => {
    for (const bad of ["-1", "1.5", "12abc", "", " 7", "0x10", "1e3", String(MAX_SEED + 1), "99999999999"]) {
      const params = parseRideParams(`?seed=${encodeURIComponent(bad)}`);
      expect(params.seed, bad).toBeNull();
      expect(params.problems, bad).toHaveLength(1);
    }
    for (const bad of ["-5", "abc", "", "Infinity", "NaN", "1e9", "1."]) {
      const params = parseRideParams(`?at=${encodeURIComponent(bad)}`);
      expect(params.startTravel, bad).toBe(0);
      expect(params.problems, bad).toHaveLength(1);
    }
  });
});

describe("urlForRide", () => {
  const base = "https://appleseed090.github.io/acid-road/";

  it("sets the seed and the start distance, keeping other parameters", () => {
    expect(urlForRide(`${base}?stats`, 42, 3000)).toBe(`${base}?stats&seed=42&at=3000`);
  });

  it("drops the start distance when the ride starts at 0", () => {
    expect(urlForRide(`${base}?seed=1&at=500`, 99, 0)).toBe(`${base}?seed=99`);
  });

  it("round-trips through parseRideParams", () => {
    const url = new URL(urlForRide(base, 777, 1234.25));
    expect(parseRideParams(url.search)).toMatchObject({ seed: 777, startTravel: 1234.25, problems: [] });
  });
});
