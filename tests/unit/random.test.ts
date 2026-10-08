import { describe, expect, it } from "vitest";
import { fractalNoise, hash3, sequence, smoothstep, valueNoise } from "../../src/world/random";

describe("hash3", () => {
  it("is deterministic and depends on the seed", () => {
    expect(hash3(7, 1, 2, 3)).toBe(hash3(7, 1, 2, 3));
    expect(hash3(7, 1, 2, 3)).not.toBe(hash3(8, 1, 2, 3));
  });

  it("stays in [0, 1)", () => {
    for (let a = -500; a < 500; a += 7) for (let b = -50; b < 50; b += 3) {
      const value = hash3(0x7ffffffe, a, b, 5);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("sequence", () => {
  it("replays the same numbers for the same key", () => {
    const first = sequence(3, 10, 101), second = sequence(3, 10, 101);
    for (let i = 0; i < 20; i++) expect(first()).toBe(second());
  });
});

describe("noise", () => {
  it("stays in [0, 1)", () => {
    for (let x = -40; x < 40; x += 0.37) for (let y = -5; y < 5; y += 0.53) {
      for (const value of [valueNoise(1, x, y, 9), fractalNoise(1, x, y)]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    }
  });
});

describe("smoothstep", () => {
  it("clamps outside the edges and is smooth between", () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
  });
});
