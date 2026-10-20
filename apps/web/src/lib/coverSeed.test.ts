import { describe, it, expect } from "vitest";
import { nextCoverSeed } from "./coverSeed";

describe("nextCoverSeed", () => {
  it("первый предмет — 20", () => {
    expect(nextCoverSeed(0)).toBe(20);
  });
  it("второй — 20 + 137.5, округлённо", () => {
    expect(nextCoverSeed(1)).toBe(158);
  });
  it("всегда в диапазоне 0–359", () => {
    for (let n = 0; n < 200; n++) {
      const s = nextCoverSeed(n);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(360);
    }
  });
  it("12 подряд созданных предметов дают 12 разных оттенков", () => {
    const seeds = new Set(Array.from({ length: 12 }, (_, n) => nextCoverSeed(n)));
    expect(seeds.size).toBe(12);
  });
  it("отрицательное и дробное число не ломают результат", () => {
    expect(nextCoverSeed(-3)).toBe(20);
    expect(nextCoverSeed(1.9)).toBe(158);
  });
});
