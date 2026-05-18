// Shared puzzle-fetching used by both the server page (initial load) and the
// API route (client-triggered reloads). Server-only.

import "server-only";
import { unstable_cache } from "next/cache";
import { generatePuzzle, type Mode } from "./generate";
import type { Puzzle } from "./puzzle";

export interface PuzzlePayload {
  puzzle: Puzzle;
  source: "ai" | "fallback";
  dateLabel: string | null;
}

function utcDate(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// Generate-once-per-day, shared across all users via Vercel Data Cache. The
// date is part of the cache key, so each UTC day is a distinct entry;
// revalidate caps a stale entry's lifetime as a safety net.
const getDailyPuzzle = unstable_cache(
  async (date: string) => generatePuzzle("daily", date),
  ["british-connections-daily"],
  { revalidate: 90000, tags: ["daily-puzzle"] }
);

export async function getPuzzle(mode: Mode): Promise<PuzzlePayload> {
  if (mode === "daily") {
    const date = utcDate();
    const { puzzle, source } = await getDailyPuzzle(date);
    return { puzzle, source, dateLabel: date };
  }
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { puzzle, source } = await generatePuzzle("endless", seed);
  return { puzzle, source, dateLabel: null };
}
