import { describe, it, expect } from "vitest";
import { DECK, deckImageUrl, pickFromDeck, type DeckEntry } from "./deck";

describe("Who's Who deck", () => {
  it("is a non-trivial list of well-formed entries", () => {
    expect(DECK.length).toBeGreaterThan(500);
    for (const e of DECK.slice(0, 50)) {
      expect(e.name.trim()).not.toBe("");
      expect(e.title.trim()).not.toBe("");
      expect(e.image).toMatch(/^https?:\/\//);
      expect(e.name).not.toMatch(/\(/); // disambiguator stripped from name
    }
  });

  it("has unique QIDs", () => {
    const qids = new Set(DECK.map((e) => e.qid));
    expect(qids.size).toBe(DECK.length);
  });

  it("builds an https, width-capped image URL", () => {
    const u = deckImageUrl(DECK[0]);
    expect(u.startsWith("https://")).toBe(true);
    expect(u).toContain("width=640");
  });

  it("pickFromDeck avoids recent identities", () => {
    const blocked = new Set(DECK.slice(0, 900).map((e) => e.name));
    const e = pickFromDeck((id) => blocked.has(id.name));
    expect(blocked.has(e.name)).toBe(false);
  });

  it("pickFromDeck still returns someone when everything is recent", () => {
    const e: DeckEntry = pickFromDeck(() => true);
    expect(e).toBeTruthy();
    expect(typeof e.name).toBe("string");
  });
});
