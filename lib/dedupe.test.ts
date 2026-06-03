import { describe, it, expect } from "vitest";
import { serveUnique, puzzleEntries } from "./dedupe";
import { inMemoryServedGroups } from "./served-groups";
import { ANCHOR_PUZZLES, type Puzzle } from "./puzzle";

const A = ANCHOR_PUZZLES[0];
const B = ANCHOR_PUZZLES[1];

describe("serveUnique", () => {
  it("serves a fresh puzzle and remembers all four groups", async () => {
    const repo = inMemoryServedGroups();
    const res = await serveUnique({
      repo,
      maxAttempts: 4,
      generate: async () => ({ puzzle: A, source: "ai" }),
    });
    expect(res.puzzle).toBe(A);
    expect(res.collisions).toBe(0);
    const seen = await repo.seen(puzzleEntries(A).map((e) => e.sig));
    expect(seen.size).toBe(4);
  });

  it("regenerates when the first candidate was already served", async () => {
    const repo = inMemoryServedGroups();
    await repo.remember(puzzleEntries(A));
    const queue: Puzzle[] = [A, B]; // first collides, second is fresh
    const res = await serveUnique({
      repo,
      maxAttempts: 4,
      generate: async () => ({ puzzle: queue.shift()!, source: "ai" }),
    });
    expect(res.puzzle).toBe(B);
    expect(res.collisions).toBe(1);
  });

  it("never throws under novelty pressure; serves a candidate and flags it", async () => {
    const repo = inMemoryServedGroups();
    await repo.remember(puzzleEntries(A)); // everything offered will collide
    const res = await serveUnique({
      repo,
      maxAttempts: 3,
      generate: async () => ({ puzzle: A, source: "ai" }),
    });
    expect(res.puzzle).toBe(A);
    expect(res.collisions).toBe(3); // === maxAttempts signals pressure
  });
});
