import { describe, it, expect } from "vitest";
import { DOMAINS, pickDomains } from "./domains";

describe("DOMAINS", () => {
  it("is a rich, de-duplicated list", () => {
    expect(DOMAINS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(DOMAINS).size).toBe(DOMAINS.length);
  });
});

describe("pickDomains", () => {
  it("returns n distinct domains", () => {
    const d = pickDomains("seed-123", 2);
    expect(d).toHaveLength(2);
    expect(new Set(d).size).toBe(2);
    for (const x of d) expect(DOMAINS).toContain(x);
  });

  it("is deterministic for the same seed", () => {
    expect(pickDomains("abc", 2)).toEqual(pickDomains("abc", 2));
  });

  it("varies across seeds", () => {
    const picks = new Set(
      Array.from({ length: 20 }, (_, i) => pickDomains(`seed-${i}`, 1)[0])
    );
    expect(picks.size).toBeGreaterThan(1);
  });
});
