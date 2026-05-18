// Pure, framework-free Connections game engine. Every function is a pure
// transition: it takes state (+ args) and returns new state. No React, no DOM.

import type { Puzzle, Group } from "./puzzle";

export const MAX_MISTAKES = 4;
export const MAX_SELECTED = 4;

export type GameStatus = "playing" | "won" | "lost";
export type GuessResult = "correct" | "one-away" | "wrong";

export interface GameState {
  puzzle: Puzzle;
  /** Words still on the board, in display order. */
  tiles: string[];
  /** Currently selected words (max 4). */
  selected: string[];
  /** Group levels solved, in the order they were solved. */
  solvedLevels: number[];
  /** Per submitted guess: the true level of each of the 4 picked words. */
  guesses: number[][];
  mistakes: number;
  status: GameStatus;
  /** Result of the most recent submit, for UI feedback. */
  lastResult: GuessResult | null;
}

type Rng = () => number;

function wordLevels(puzzle: Puzzle): Map<string, number> {
  const m = new Map<string, number>();
  for (const g of puzzle) for (const w of g.members) m.set(w, g.level);
  return m;
}

function groupByLevel(puzzle: Puzzle, level: number): Group {
  return puzzle.find((g) => g.level === level) as Group;
}

export function shuffleArray<T>(arr: T[], rng: Rng = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createGame(puzzle: Puzzle, rng: Rng = Math.random): GameState {
  const words = puzzle.flatMap((g) => g.members);
  return {
    puzzle,
    tiles: shuffleArray(words, rng),
    selected: [],
    solvedLevels: [],
    guesses: [],
    mistakes: 0,
    status: "playing",
    lastResult: null,
  };
}

export function toggle(state: GameState, word: string): GameState {
  if (state.status !== "playing") return state;
  if (!state.tiles.includes(word)) return state;
  const isSel = state.selected.includes(word);
  if (!isSel && state.selected.length >= MAX_SELECTED) return state;
  return {
    ...state,
    selected: isSel
      ? state.selected.filter((w) => w !== word)
      : [...state.selected, word],
  };
}

export function deselectAll(state: GameState): GameState {
  return { ...state, selected: [] };
}

export function shuffleTiles(state: GameState, rng: Rng = Math.random): GameState {
  return { ...state, tiles: shuffleArray(state.tiles, rng) };
}

/** True levels of the currently selected words. */
function selectedLevels(state: GameState): number[] {
  const levels = wordLevels(state.puzzle);
  return state.selected.map((w) => levels.get(w) as number);
}

function maxSameCount(levels: number[]): { level: number; count: number } {
  const counts = new Map<number, number>();
  for (const l of levels) counts.set(l, (counts.get(l) ?? 0) + 1);
  let best = { level: levels[0], count: 0 };
  for (const [level, count] of counts) {
    if (count > best.count) best = { level, count };
  }
  return best;
}

function solveLevel(state: GameState, level: number): GameState {
  const group = groupByLevel(state.puzzle, level);
  return {
    ...state,
    tiles: state.tiles.filter((w) => !group.members.includes(w)),
    solvedLevels: [...state.solvedLevels, level],
  };
}

/**
 * Submit the 4 selected words. Returns new state with updated solved groups,
 * mistakes, guess history, status, and lastResult. On loss, all remaining
 * groups are auto-revealed (lowest level first).
 */
export function submit(state: GameState): GameState {
  if (state.status !== "playing" || state.selected.length !== MAX_SELECTED) {
    return state;
  }
  const levels = selectedLevels(state);
  const guesses = [...state.guesses, levels];
  const best = maxSameCount(levels);

  if (best.count === 4) {
    let next: GameState = { ...state, guesses, selected: [], lastResult: "correct" };
    next = solveLevel(next, best.level);
    if (next.solvedLevels.length === 4) next = { ...next, status: "won" };
    return next;
  }

  const mistakes = state.mistakes + 1;
  const lastResult: GuessResult = best.count === 3 ? "one-away" : "wrong";

  if (mistakes >= MAX_MISTAKES) {
    // Reveal everything not yet solved, lowest level first.
    let next: GameState = {
      ...state,
      guesses,
      mistakes,
      lastResult,
      selected: [],
      status: "lost",
    };
    const remaining = [0, 1, 2, 3]
      .filter((l) => !next.solvedLevels.includes(l))
      .sort((a, b) => a - b);
    for (const l of remaining) next = solveLevel(next, l);
    return next;
  }

  return { ...state, guesses, mistakes, lastResult, selected: [] };
}

/** Spoiler-free shareable result block (Wordle-style). */
export function shareText(
  state: GameState,
  opts: { mode: "daily" | "endless"; dateLabel?: string; url?: string }
): string {
  const square = ["🟨", "🟩", "🟦", "🟪"];
  const header =
    opts.mode === "daily"
      ? `British Connections — Daily ${opts.dateLabel ?? ""}`.trim()
      : "British Connections — Endless";
  const outcome =
    state.status === "won"
      ? `Solved with ${state.mistakes} mistake${state.mistakes === 1 ? "" : "s"}`
      : "Didn't get it";
  const grid = state.guesses
    .map((row) => row.map((l) => square[l]).join(""))
    .join("\n");
  return [header, outcome, "", grid, opts.url ?? ""].filter(Boolean).join("\n");
}
