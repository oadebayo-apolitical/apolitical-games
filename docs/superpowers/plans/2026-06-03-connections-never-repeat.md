# Connections Never-Repeat Endless Puzzles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guarantee an endless-mode group (its four words) is never served twice, while making generated puzzles more varied — by verifying every generated puzzle against a permanent global store and regenerating on collision.

**Architecture:** A puzzle's four groups each get a stable order/case-insensitive **signature**. A swappable `ServedGroupsRepo` (MongoDB Atlas in prod, no-op when `MONGODB_URI` is unset, in-memory for tests) permanently records served signatures. The endless path runs a pure `serveUnique` loop: generate → check signatures → regenerate on any collision (bounded) → remember → serve. The generation prompt stops priming London Underground / NEW___ and rotates a curated domain list for variety. Daily mode is unchanged.

**Tech Stack:** TypeScript, Next.js 16, Vitest, `@anthropic-ai/sdk`, `mongodb` driver.

**Key constraint (from `AGENTS.md`):** this is a non-standard Next.js build — before editing the API route or runtime config, skim the relevant guide under `node_modules/next/dist/docs/`. The changes here are confined to `lib/` server modules and don't alter routing, but check the caching doc if `unstable_cache` behaviour looks off.

**Module boundaries (why the split):** Vitest runs in Node, where importing the `server-only` package throws. Existing tests only ever import pure modules (`puzzle.ts`, `deck.ts`, `personality.ts`), never `*-service.ts`. So **all testable logic lives in non-`server-only` modules** (`puzzle.ts`, `domains.ts`, `served-groups.ts`, `dedupe.ts`); only the Mongo I/O (`mongo.ts`, `served-groups-mongo.ts`) and the existing services are `server-only`.

**Deviation from spec:** the spec's stored doc included a `normName` field for hypothetical name-matching. Dropped per YAGNI — the hard block is the member-set `sig`, and soft steering uses the readable `name` directly in the prompt avoid-list. Stored doc is `{ sig, name, members, createdAt }`.

---

### Task 1: Group signature helper

**Files:**
- Modify: `lib/puzzle.ts` (append a new export)
- Test: `lib/puzzle.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `lib/puzzle.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { groupSignature } from "./puzzle";

describe("groupSignature", () => {
  it("is independent of member order", () => {
    const a = groupSignature({ members: ["ROBIN", "SWIFT", "SWALLOW", "WREN"] });
    const b = groupSignature({ members: ["WREN", "ROBIN", "SWALLOW", "SWIFT"] });
    expect(a).toBe(b);
  });

  it("is case- and whitespace-insensitive", () => {
    const a = groupSignature({ members: ["Robin", " swift ", "Swallow", "wren"] });
    const b = groupSignature({ members: ["ROBIN", "SWIFT", "SWALLOW", "WREN"] });
    expect(a).toBe(b);
  });

  it("differs when any member differs", () => {
    expect(groupSignature({ members: ["A", "B", "C", "D"] })).not.toBe(
      groupSignature({ members: ["A", "B", "C", "E"] })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/puzzle.test.ts`
Expected: FAIL — `groupSignature` is not exported from `./puzzle`.

- [ ] **Step 3: Add the implementation**

Append to `lib/puzzle.ts` (after `normalisePuzzle`):

```ts
/**
 * Stable signature for a group: its four words, normalised (trimmed, uppercased)
 * and sorted, joined with "|". Same four words in any order/case ⇒ same signature.
 * This is the unit of the "never serve a group twice" guarantee.
 */
export function groupSignature(group: { members: readonly string[] }): string {
  return group.members
    .map((m) => m.trim().toUpperCase())
    .sort()
    .join("|");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/puzzle.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/puzzle.ts lib/puzzle.test.ts
git commit -m "Connections: add order/case-insensitive group signature"
```

---

### Task 2: Curated domain list + deterministic picker

**Files:**
- Create: `lib/domains.ts`
- Test: `lib/domains.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/domains.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/domains.test.ts`
Expected: FAIL — cannot resolve `./domains`.

- [ ] **Step 3: Create the implementation**

Create `lib/domains.ts`:

```ts
// Curated British cultural / wordplay domains. The endless generator is nudged
// toward a couple of these each round so it stops defaulting to the same handful
// of categories (London Underground, NEW___, football...). Inspiration, not law;
// the never-repeat guarantee is enforced separately by group signatures.
export const DOMAINS: string[] = [
  "biscuits and sweets",
  "motorways and A-roads",
  "soap operas",
  "cricket terms",
  "cockney rhyming slang",
  "monarchs and royal houses",
  "seaside and coastal towns",
  "pub names and pub games",
  "British cheeses",
  "weather and types of rain",
  "homophones",
  "hidden words inside longer words",
  "shared prefixes (X ___)",
  "shared suffixes (___ X)",
  "British sitcoms and panel shows",
  "puddings and desserts",
  "garden birds and wildlife",
  "rivers and lochs",
  "counties and shires",
  "tea and biscuit culture",
  "snooker and darts",
  "rugby and its positions",
  "British slang for money",
  "school and exam terms",
  "market and high-street shops",
  "trains and railway stations",
  "castles and stately homes",
  "folk customs and festivals",
  "British inventors and scientists",
  "musicians and bands",
  "playwrights and authors",
  "classic British car marques",
  "fish and chips and takeaway food",
  "regional dialect words",
  "nursery rhymes and playground games",
];

/**
 * Pick `n` distinct domains deterministically from a seed string, using a small
 * LCG so the same seed always yields the same picks (testable) while different
 * per-request seeds spread across the list.
 */
export function pickDomains(seed: string, n: number): string[] {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  let x = Math.abs(h) || 1;
  const used = new Set<number>();
  const out: string[] = [];
  const want = Math.min(n, DOMAINS.length);
  while (out.length < want) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const i = x % DOMAINS.length;
    if (!used.has(i)) {
      used.add(i);
      out.push(DOMAINS[i]);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/domains.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/domains.ts lib/domains.test.ts
git commit -m "Connections: curated domain list + deterministic picker for variety"
```

---

### Task 3: ServedGroups repository (interface + in-memory + no-op)

**Files:**
- Create: `lib/served-groups.ts` (pure — NO `server-only`)
- Test: `lib/served-groups.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/served-groups.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { inMemoryServedGroups, noopServedGroups } from "./served-groups";

describe("inMemoryServedGroups", () => {
  it("remembers signatures and reports which are seen", async () => {
    const repo = inMemoryServedGroups();
    expect((await repo.seen(["a", "b"])).size).toBe(0);
    await repo.remember([{ sig: "a", name: "Alpha", members: ["A"] }]);
    const seen = await repo.seen(["a", "b"]);
    expect(seen.has("a")).toBe(true);
    expect(seen.has("b")).toBe(false);
  });

  it("recentNames returns most-recent first", async () => {
    const repo = inMemoryServedGroups();
    await repo.remember([{ sig: "1", name: "One", members: [] }]);
    await repo.remember([{ sig: "2", name: "Two", members: [] }]);
    expect(await repo.recentNames(10)).toEqual(["Two", "One"]);
  });

  it("ignores a repeated signature on remember", async () => {
    const repo = inMemoryServedGroups();
    await repo.remember([{ sig: "x", name: "X", members: [] }]);
    await repo.remember([{ sig: "x", name: "X again", members: [] }]);
    expect(await repo.recentNames(10)).toEqual(["X"]);
  });
});

describe("noopServedGroups", () => {
  it("never records anything", async () => {
    const repo = noopServedGroups();
    await repo.remember([{ sig: "a", name: "A", members: [] }]);
    expect((await repo.seen(["a"])).size).toBe(0);
    expect(await repo.recentNames(10)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/served-groups.test.ts`
Expected: FAIL — cannot resolve `./served-groups`.

- [ ] **Step 3: Create the implementation**

Create `lib/served-groups.ts`:

```ts
// The "have we served this group before?" store, behind a swappable interface.
// Pure module (no server-only) so it can be unit-tested and so dedup logic in
// dedupe.ts can import its types without pulling in the Mongo driver.

export interface ServedGroup {
  sig: string; // groupSignature(group) — the never-repeat key
  name: string; // readable category name, for the prompt avoid-list
  members: string[];
}

export interface ServedGroupsRepo {
  /** Of the given signatures, which have already been served. */
  seen(signatures: string[]): Promise<Set<string>>;
  /** Permanently record these groups as served (idempotent by sig). */
  remember(groups: ServedGroup[]): Promise<void>;
  /** Most-recently-served category names, newest first, for prompt steering. */
  recentNames(limit: number): Promise<string[]>;
}

/** In-memory implementation — used by tests and as a single-process fallback. */
export function inMemoryServedGroups(): ServedGroupsRepo {
  const order: ServedGroup[] = [];
  const sigs = new Set<string>();
  return {
    async seen(signatures) {
      return new Set(signatures.filter((s) => sigs.has(s)));
    },
    async remember(groups) {
      for (const g of groups) {
        if (!sigs.has(g.sig)) {
          sigs.add(g.sig);
          order.push(g);
        }
      }
    },
    async recentNames(limit) {
      return order.slice(-limit).reverse().map((g) => g.name);
    },
  };
}

/** No-op implementation — when no store is configured, the game plays with no dedup. */
export function noopServedGroups(): ServedGroupsRepo {
  return {
    async seen() {
      return new Set();
    },
    async remember() {},
    async recentNames() {
      return [];
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/served-groups.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/served-groups.ts lib/served-groups.test.ts
git commit -m "Connections: ServedGroupsRepo interface + in-memory and no-op impls"
```

---

### Task 4: `serveUnique` — the generate/verify/regenerate loop

**Files:**
- Create: `lib/dedupe.ts` (pure — NO `server-only`)
- Test: `lib/dedupe.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/dedupe.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/dedupe.test.ts`
Expected: FAIL — cannot resolve `./dedupe`.

- [ ] **Step 3: Create the implementation**

Create `lib/dedupe.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/dedupe.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the whole suite (no regressions)**

Run: `npm test`
Expected: PASS — all pre-existing tests plus the four new files.

- [ ] **Step 6: Commit**

```bash
git add lib/dedupe.ts lib/dedupe.test.ts
git commit -m "Connections: serveUnique generate/verify/regenerate loop"
```

---

### Task 5: MongoDB connection singleton

**Files:**
- Modify: `package.json` (add `mongodb` dependency)
- Create: `lib/mongo.ts` (`server-only`)

No unit test (network I/O); verified by typecheck now and end-to-end in Task 9.

- [ ] **Step 1: Install the driver**

Run: `npm install mongodb`
Expected: `mongodb` appears under `dependencies` in `package.json`.

- [ ] **Step 2: Create the connection singleton**

Create `lib/mongo.ts`:

```ts
// Server-only MongoDB connection, cached on globalThis so Next's dev hot-reload
// and serverless invocations reuse one client. Returns null (never throws) when
// MONGODB_URI is unset or the cluster is unreachable, so callers degrade to no-op.

import "server-only";
import { MongoClient, type Db } from "mongodb";

const DB_NAME = "apol_games";
const COLLECTION = "served_groups";

const g = globalThis as unknown as { _connMongo?: Promise<MongoClient> };

export async function getDb(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  try {
    if (!g._connMongo) {
      g._connMongo = new MongoClient(uri)
        .connect()
        .then(async (client) => {
          // Permanent uniqueness key; idempotent to create.
          await client
            .db(DB_NAME)
            .collection(COLLECTION)
            .createIndex({ sig: 1 }, { unique: true });
          return client;
        });
    }
    const client = await g._connMongo;
    return client.db(DB_NAME);
  } catch (err) {
    g._connMongo = undefined; // allow a later retry
    console.error("[connections] mongo.connect failed:", err);
    return null;
  }
}

export const SERVED_GROUPS_COLLECTION = COLLECTION;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json lib/mongo.ts
git commit -m "Connections: MongoDB connection singleton (degrades to null)"
```

---

### Task 6: Mongo-backed repository + store selector

**Files:**
- Create: `lib/served-groups-mongo.ts` (`server-only`)

No unit test (network I/O); verified end-to-end in Task 9.

- [ ] **Step 1: Create the implementation**

Create `lib/served-groups-mongo.ts`:

```ts
// Server-only MongoDB implementation of ServedGroupsRepo, plus the selector that
// picks Mongo when MONGODB_URI is set and falls back to no-op otherwise. Every
// method degrades gracefully (getDb() can return null) so a store outage never
// breaks play — it just means no dedup for that request.

import "server-only";
import { getDb, SERVED_GROUPS_COLLECTION } from "./mongo";
import {
  noopServedGroups,
  type ServedGroupsRepo,
} from "./served-groups";

export function mongoServedGroups(): ServedGroupsRepo {
  return {
    async seen(signatures) {
      const db = await getDb();
      if (!db || signatures.length === 0) return new Set();
      const docs = await db
        .collection(SERVED_GROUPS_COLLECTION)
        .find({ sig: { $in: signatures } }, { projection: { sig: 1, _id: 0 } })
        .toArray();
      return new Set(docs.map((d) => d.sig as string));
    },
    async remember(groups) {
      const db = await getDb();
      if (!db || groups.length === 0) return;
      const col = db.collection(SERVED_GROUPS_COLLECTION);
      // Idempotent upsert on sig so a concurrent double-serve can't throw on the
      // unique index.
      await Promise.all(
        groups.map((gr) =>
          col.updateOne(
            { sig: gr.sig },
            {
              $setOnInsert: {
                sig: gr.sig,
                name: gr.name,
                members: gr.members,
                createdAt: new Date(),
              },
            },
            { upsert: true }
          )
        )
      );
    },
    async recentNames(limit) {
      const db = await getDb();
      if (!db) return [];
      const docs = await db
        .collection(SERVED_GROUPS_COLLECTION)
        .find({}, { projection: { name: 1, _id: 0 } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
      return docs.map((d) => d.name as string).filter(Boolean);
    },
  };
}

/** Mongo when configured, otherwise no-op (game still plays, just no dedup). */
export function getServedGroups(): ServedGroupsRepo {
  return process.env.MONGODB_URI ? mongoServedGroups() : noopServedGroups();
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/served-groups-mongo.ts
git commit -m "Connections: Mongo-backed served-groups repo + store selector"
```

---

### Task 7: Generation prompt — stop priming, accept avoid-list + domains

**Files:**
- Modify: `lib/generate.ts`

No unit test (the module calls the Anthropic API and imports `server-only`); the prompt changes are covered indirectly by the Task 9 end-to-end run.

- [ ] **Step 1: Add the anti-priming instruction to the frozen SYSTEM prompt**

In `lib/generate.ts`, replace this line (currently around line 37):

```ts
Here are hand-authored reference puzzles that set the quality bar. Match this style and trap density:
```

with:

```ts
Here are hand-authored reference puzzles that set the quality bar. They are STYLE references only — match their format and trap density, but do NOT reuse their categories, themes, or answer words (for example, do not produce another "London Underground" or "NEW ___" group):
```

(The SYSTEM block stays frozen, so prompt caching is preserved.)

- [ ] **Step 2: Add a context type and thread it through the user prompt**

In `lib/generate.ts`, replace the `userPrompt` function (currently lines 73-78):

```ts
function userPrompt(mode: Mode, seed: string): string {
  if (mode === "daily") {
    return `Generate the British Connections puzzle for ${seed}. Make it a balanced, polished daily puzzle with strong overlap traps across all four groups.`;
  }
  return `Generate a fresh British Connections puzzle. Make it distinct from common themes — vary the categories. Variation token: ${seed}.`;
}
```

with:

```ts
export interface GenContext {
  /** Recently-served category names to steer away from. */
  avoidNames?: string[];
  /** Domains to lean into this round, for variety. */
  domains?: string[];
}

function userPrompt(mode: Mode, seed: string, ctx?: GenContext): string {
  if (mode === "daily") {
    return `Generate the British Connections puzzle for ${seed}. Make it a balanced, polished daily puzzle with strong overlap traps across all four groups.`;
  }
  const lines = [
    "Generate a fresh British Connections puzzle. Vary the categories and aim for inventive, surprising groups.",
  ];
  if (ctx?.domains?.length) {
    lines.push(
      `For variety this round, lean into domains like: ${ctx.domains.join(
        "; "
      )}. Use them as inspiration, not a strict requirement.`
    );
  }
  if (ctx?.avoidNames?.length) {
    lines.push(
      `Do NOT reuse any of these recently-used category ideas — pick clearly different themes and answer words: ${ctx.avoidNames.join(
        "; "
      )}.`
    );
  }
  lines.push(`Variation token: ${seed}.`);
  return lines.join("\n");
}
```

- [ ] **Step 3: Thread `ctx` through `callOnce` and `generatePuzzle`**

In `lib/generate.ts`, change the `callOnce` signature and its `userPrompt` call (currently line 91 / line 101):

```ts
async function callOnce(mode: Mode, seed: string, ctx?: GenContext): Promise<Puzzle | null> {
```

```ts
    messages: [{ role: "user", content: userPrompt(mode, seed, ctx) }],
```

And change `generatePuzzle` (currently lines 126-132) to accept and forward `ctx`:

```ts
export async function generatePuzzle(
  mode: Mode,
  seed: string,
  ctx?: GenContext
): Promise<{ puzzle: Puzzle; source: "ai" | "fallback" }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const p = await callOnce(mode, seed, ctx);
```

(The rest of `generatePuzzle` — the catch block and the `fallbackPuzzle` return — is unchanged.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/generate.ts
git commit -m "Connections: stop priming anchors; accept avoid-list + domain context"
```

---

### Task 8: Connections logger + wire endless through `serveUnique`

**Files:**
- Modify: `lib/log.ts` (add `clog`)
- Modify: `lib/puzzle-service.ts` (endless path)

- [ ] **Step 1: Add a connections logger**

In `lib/log.ts`, append (mirrors the existing `wlog`, different prefix):

```ts
// Same one-line-per-event format as wlog, tagged for the Connections pipeline.
export function clog(event: string, fields: Record<string, unknown> = {}) {
  const parts = Object.entries(fields).map(
    ([k, v]) => `${k}=${typeof v === "string" ? `"${v}"` : JSON.stringify(v)}`
  );
  console.log(`[connections] ${event} ${parts.join(" ")}`.trimEnd());
}
```

- [ ] **Step 2: Wire the endless path**

In `lib/puzzle-service.ts`, add these imports below the existing ones (after line 7):

```ts
import { serveUnique } from "./dedupe";
import { getServedGroups } from "./served-groups-mongo";
import { pickDomains } from "./domains";
import { clog } from "./log";
```

Then replace the endless branch of `getPuzzle` (currently lines 34-36):

```ts
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { puzzle, source } = await generatePuzzle("endless", seed);
  return { puzzle, source, dateLabel: null };
```

with:

```ts
  const repo = getServedGroups();
  const avoidNames = await repo.recentNames(40);
  const maxAttempts = 4;
  const { puzzle, source, collisions } = await serveUnique({
    repo,
    maxAttempts,
    generate: async () => {
      const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      return generatePuzzle("endless", seed, {
        avoidNames,
        domains: pickDomains(seed, 2),
      });
    },
  });
  clog(collisions >= maxAttempts ? "novelty.pressure" : "gen.ok", {
    source,
    collisions,
  });
  return { puzzle, source, dateLabel: null };
```

- [ ] **Step 3: Typecheck and full test suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/log.ts lib/puzzle-service.ts
git commit -m "Connections: route endless puzzles through never-repeat serveUnique"
```

---

### Task 9: End-to-end repro + verification

**Files:**
- Create: `scripts/check-endless-unique.mjs`
- Modify: `package.json` (add a `check:endless` script)

**Prerequisites (one-time, in the MongoDB Atlas console):**
- Network Access → add your current IP (or `0.0.0.0/0` for a throwaway test).
- Confirm `MONGODB_URI` is in `.env.local` (already added) and `ANTHROPIC_API_KEY` is set.

- [ ] **Step 1: Create the repro script**

Create `scripts/check-endless-unique.mjs`:

```js
// Direct reproduction of the reported bug: hit the endless endpoint N times and
// assert no group (its four words) is ever served twice. Start the app first:
//   npm run dev        # in another terminal
//   npm run check:endless 20
const N = Number(process.argv[2] ?? 15);
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const sig = (members) =>
  members.map((m) => m.trim().toUpperCase()).sort().join("|");

const seen = new Map(); // sig -> first name seen
let repeats = 0;

for (let i = 0; i < N; i++) {
  const res = await fetch(`${BASE}/api/puzzle?mode=endless`, { cache: "no-store" });
  if (!res.ok) {
    console.error(`request ${i + 1} failed: HTTP ${res.status}`);
    process.exit(1);
  }
  const { puzzle, source } = await res.json();
  for (const g of puzzle) {
    const s = sig(g.members);
    if (seen.has(s)) {
      repeats++;
      console.log(`  REPEAT on play ${i + 1}: "${g.name}" == earlier "${seen.get(s)}"`);
    } else {
      seen.set(s, g.name);
    }
  }
  console.log(`play ${i + 1}/${N} source=${source} uniqueGroups=${seen.size}`);
}

if (repeats === 0) {
  console.log(`\nPASS: ${seen.size} unique groups across ${N} plays, zero repeats.`);
  process.exit(0);
}
console.log(`\nFAIL: ${repeats} repeated group(s).`);
process.exit(1);
```

- [ ] **Step 2: Add the npm script**

In `package.json`, add to `"scripts"`:

```json
    "check:endless": "node scripts/check-endless-unique.mjs"
```

- [ ] **Step 3: Run the app and the check**

In one terminal: `npm run dev`
In another: `npm run check:endless 20`
Expected: `PASS: … zero repeats.` and log lines showing `source=ai` for most plays.

- [ ] **Step 4: Confirm the store is filling**

In the dev-server terminal, confirm `[connections] gen.ok` lines appear (and ideally no `novelty.pressure` on a fresh store). Optionally, in the Atlas UI, the `apol_games.served_groups` collection should show ~`4 × plays` documents, each with `sig`, `name`, `members`, `createdAt`.

- [ ] **Step 5: Verify graceful degradation**

Temporarily run with the store disabled and confirm the game still serves puzzles:
Run: `MONGODB_URI= npm run dev` then `npm run check:endless 3`
Expected: requests still succeed (repeats are possible here — that's fine; the point is **no crash** and `source` is still returned).

- [ ] **Step 6: Commit**

```bash
git add scripts/check-endless-unique.mjs package.json
git commit -m "Connections: end-to-end never-repeat check script"
```

---

## Self-Review

**Spec coverage:**
- Permanent group-level uniqueness → `groupSignature` (Task 1) + `serveUnique` remembering on every serve (Task 4) + permanent Mongo store, no TTL (Tasks 5–6). ✓
- Global scope, no user identity → store is keyed only by signature. ✓
- Approach B (verify + regenerate) → `serveUnique` loop (Task 4), wired in Task 8. ✓
- Swappable repo, Mongo default, graceful no-op degradation → Tasks 3, 5, 6; degradation verified Task 9 Step 5. ✓
- Stop priming + rotating domains → Tasks 7 & 2. ✓
- Caching preserved (dynamic context in user message, SYSTEM frozen) → Task 7. ✓
- Fallback exemption → `serveUnique` treats fallback puzzles uniformly and may serve under pressure; not special-cased. ✓
- Novelty-pressure logged, never blocks → Task 4 + `clog` in Task 8. ✓
- Logging events (`gen.ok`, `novelty.pressure`, mongo failure) → Task 8 `clog`, plus `console.error` in `mongo.ts` (Task 5). ✓
- Tests: signature, repository, loop, degradation, repro script → Tasks 1,3,4,9. ✓

**Placeholder scan:** none — every code step contains full code; every command has expected output.

**Type consistency:** `ServedGroup` (`{sig,name,members}`) and `ServedGroupsRepo` (`seen`/`remember`/`recentNames`) are defined in Task 3 and used identically in Tasks 4, 6, 8. `serveUnique` opts (`generate`/`repo`/`maxAttempts`) and result (`puzzle`/`source`/`collisions`) match between Task 4 definition and Task 8 caller. `GenContext` (`avoidNames`/`domains`) defined in Task 7 and constructed in Task 8. `groupSignature` signature stable across Tasks 1 and 4. ✓
