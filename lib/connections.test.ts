import { describe, it, expect } from "vitest";
import {
  createGame,
  toggle,
  deselectAll,
  submit,
  shareText,
  MAX_MISTAKES,
} from "./connections";
import { validatePuzzle, ANCHOR_PUZZLES } from "./puzzle";
import type { Puzzle } from "./puzzle";

const P: Puzzle = ANCHOR_PUZZLES[0];
// seq rng for deterministic shuffles (identity-ish: never swaps)
const noShuffle = () => 0.9999999;

function selectGroup(state: ReturnType<typeof createGame>, level: number) {
  const group = P.find((g) => g.level === level)!;
  let s = state;
  for (const w of group.members) s = toggle(s, w);
  return s;
}

describe("anchor puzzles", () => {
  it("are all structurally valid", () => {
    for (const p of ANCHOR_PUZZLES) {
      expect(validatePuzzle(p)).toEqual({ ok: true });
    }
  });
});

describe("createGame", () => {
  it("puts all 16 words on the board, nothing selected/solved", () => {
    const s = createGame(P, noShuffle);
    expect(s.tiles).toHaveLength(16);
    expect(new Set(s.tiles).size).toBe(16);
    expect(s.selected).toEqual([]);
    expect(s.solvedLevels).toEqual([]);
    expect(s.status).toBe("playing");
  });
});

describe("toggle", () => {
  it("selects then deselects a word and caps at 4", () => {
    let s = createGame(P, noShuffle);
    const [a, b, c, d, e] = s.tiles;
    s = toggle(s, a);
    expect(s.selected).toEqual([a]);
    s = toggle(s, a);
    expect(s.selected).toEqual([]);
    s = toggle(toggle(toggle(toggle(s, a), b), c), d);
    expect(s.selected).toHaveLength(4);
    s = toggle(s, e); // 5th rejected
    expect(s.selected).toHaveLength(4);
    expect(s.selected).not.toContain(e);
  });
});

describe("submit", () => {
  it("solves a correct group and clears selection", () => {
    let s = createGame(P, noShuffle);
    s = selectGroup(s, 0);
    s = submit(s);
    expect(s.lastResult).toBe("correct");
    expect(s.solvedLevels).toEqual([0]);
    expect(s.tiles).toHaveLength(12);
    expect(s.selected).toEqual([]);
  });

  it("wins when all four groups are solved", () => {
    let s = createGame(P, noShuffle);
    for (const lvl of [2, 0, 3, 1]) {
      s = selectGroup(s, lvl);
      s = submit(s);
    }
    expect(s.status).toBe("won");
    expect(s.solvedLevels).toEqual([2, 0, 3, 1]);
  });

  it("reports one-away when 3 of 4 share a group", () => {
    let s = createGame(P, noShuffle);
    const g0 = P.find((g) => g.level === 0)!;
    const g1 = P.find((g) => g.level === 1)!;
    s = toggle(s, g0.members[0]);
    s = toggle(s, g0.members[1]);
    s = toggle(s, g0.members[2]);
    s = toggle(s, g1.members[0]);
    s = submit(s);
    expect(s.lastResult).toBe("one-away");
    expect(s.mistakes).toBe(1);
  });

  it("loses after MAX_MISTAKES and reveals all groups in order", () => {
    let s = createGame(P, noShuffle);
    const g0 = P.find((g) => g.level === 0)!;
    const g1 = P.find((g) => g.level === 1)!;
    const wrong = [g0.members[0], g0.members[1], g1.members[0], g1.members[1]];
    for (let i = 0; i < MAX_MISTAKES; i++) {
      let t = s;
      for (const w of wrong) t = toggle(t, w);
      s = submit(t);
    }
    expect(s.status).toBe("lost");
    expect(s.mistakes).toBe(MAX_MISTAKES);
    expect(s.solvedLevels).toEqual([0, 1, 2, 3]);
    expect(s.tiles).toHaveLength(0);
  });

  it("ignores submit unless exactly 4 are selected", () => {
    let s = createGame(P, noShuffle);
    s = toggle(s, s.tiles[0]);
    expect(submit(s)).toBe(s);
  });
});

describe("deselectAll", () => {
  it("clears selection", () => {
    let s = createGame(P, noShuffle);
    s = toggle(toggle(s, s.tiles[0]), s.tiles[1]);
    s = deselectAll(s);
    expect(s.selected).toEqual([]);
  });
});

describe("shareText", () => {
  it("includes header, outcome and an emoji grid", () => {
    let s = createGame(P, noShuffle);
    s = selectGroup(s, 0);
    s = submit(s);
    const txt = shareText(s, { mode: "daily", dateLabel: "2026-05-18" });
    expect(txt).toContain("British Connections — Daily 2026-05-18");
    expect(txt).toContain("🟨");
  });
});
