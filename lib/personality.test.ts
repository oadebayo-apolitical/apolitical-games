import { describe, it, expect } from "vitest";
import {
  normalise,
  isCorrectGuess,
  validatePersonality,
  normalisePersonality,
  FALLBACK_FIGURES,
  type Personality,
} from "./personality";

const P: Personality = {
  name: "David Attenborough",
  wikipediaTitle: "David Attenborough",
  category: "Naturalist",
  hints: ["a", "b", "c", "d", "e"],
  acceptableAnswers: ["attenborough"],
};

describe("normalise", () => {
  it("lowercases, strips accents and punctuation", () => {
    expect(normalise("  Béyoncé  Knowlés ")).toBe("beyonce knowles");
    expect(normalise("O'Brien-Smith")).toBe("o brien smith");
  });
});

describe("isCorrectGuess", () => {
  it("accepts full name regardless of case/spacing/punctuation", () => {
    expect(isCorrectGuess("david attenborough", P)).toBe(true);
    expect(isCorrectGuess("  DAVID   ATTENBOROUGH ", P)).toBe(true);
  });
  it("accepts the surname alone", () => {
    expect(isCorrectGuess("Attenborough", P)).toBe(true);
  });
  it("accepts an honorific-prefixed guess", () => {
    expect(isCorrectGuess("Sir David Attenborough", P)).toBe(true);
  });
  it("rejects a wrong name and empty input", () => {
    expect(isCorrectGuess("David Bowie", P)).toBe(false);
    expect(isCorrectGuess("   ", P)).toBe(false);
  });
  it("does not accept a too-short / first-name-only guess", () => {
    expect(isCorrectGuess("David", P)).toBe(false);
  });
});

describe("validatePersonality", () => {
  it("passes a well-formed personality", () => {
    expect(validatePersonality(P)).toEqual({ ok: true });
  });
  it("rejects missing fields and short hint lists", () => {
    expect(validatePersonality({ ...P, name: "" }).ok).toBe(false);
    expect(validatePersonality({ ...P, hints: ["x"] }).ok).toBe(false);
  });
  it("rejects a personality whose hint leaks the surname", () => {
    const leak = { ...P, hints: ["he is called Attenborough", "b", "c", "d"] };
    expect(validatePersonality(leak).ok).toBe(false);
  });
  it("accepts all baked fallback figures", () => {
    for (const f of FALLBACK_FIGURES) {
      expect(validatePersonality(f)).toEqual({ ok: true });
    }
  });
});

describe("normalisePersonality", () => {
  it("pads/truncates to exactly 5 hints", () => {
    const short = normalisePersonality({ ...P, hints: ["a", "b", "c", "d"] });
    expect(short.hints).toHaveLength(5);
    const long = normalisePersonality({
      ...P,
      hints: ["a", "b", "c", "d", "e", "f"],
    });
    expect(long.hints).toEqual(["a", "b", "c", "d", "e"]);
  });
});
