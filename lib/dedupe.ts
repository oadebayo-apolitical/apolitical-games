// Pure orchestration of "generate a puzzle whose groups have never been served".
// No server-only / no Anthropic / no Mongo here — the caller injects `generate`
// and `repo`, which keeps this fully unit-testable.

import type { Puzzle } from "./puzzle";
import { groupSignature } from "./puzzle";
import type { ServedGroup, ServedGroupsRepo } from "./served-groups";

/** A puzzle's four groups as repository entries. */
export function puzzleEntries(puzzle: Puzzle): ServedGroup[] {
  return puzzle.map((g) => ({
    sig: groupSignature(g),
    name: g.name,
    members: [...g.members],
  }));
}

export interface ServeUniqueResult {
  puzzle: Puzzle;
  source: "ai" | "fallback";
  /** How many collisions before serving. `=== maxAttempts` means novelty pressure. */
  collisions: number;
}

export async function serveUnique(opts: {
  generate: () => Promise<{ puzzle: Puzzle; source: "ai" | "fallback" }>;
  repo: ServedGroupsRepo;
  maxAttempts: number;
}): Promise<ServeUniqueResult> {
  const { generate, repo, maxAttempts } = opts;
  let best: { puzzle: Puzzle; source: "ai" | "fallback"; novel: ServedGroup[] } | null =
    null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { puzzle, source } = await generate();
    const entries = puzzleEntries(puzzle);
    const seen = await repo.seen(entries.map((e) => e.sig));
    const novel = entries.filter((e) => !seen.has(e.sig));

    if (novel.length === entries.length) {
      await repo.remember(entries);
      return { puzzle, source, collisions: attempt };
    }
    if (!best || novel.length > best.novel.length) {
      best = { puzzle, source, novel };
    }
  }

  // Novelty pressure: nothing fully fresh after maxAttempts. Serve the
  // least-colliding candidate, record only its novel groups, and let the caller
  // log it. The player is never blocked.
  await repo.remember(best!.novel);
  return { puzzle: best!.puzzle, source: best!.source, collisions: maxAttempts };
}
