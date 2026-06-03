# British Connections — Never-Repeat Endless Puzzles

**Date:** 2026-06-03
**Status:** Approved design, pre-implementation

## Problem

In **endless** mode the game repeatedly serves the same groups — most notably
"London Underground lines" and "NEW ___" (Newcastle/Newport). The user reported
seeing London-station and Newcastle groups multiple times across plays.

This is **not** a caching bug. Daily mode is correctly generated once per UTC day
and shared via Vercel Data Cache (`lib/puzzle-service.ts:22`). Endless mode is
intentionally uncached (`lib/puzzle-service.ts:34`). The repeats come from three
compounding causes in endless generation:

1. **No memory, and we give the model none.** Each endless request is a stateless
   API call. The only "variation" passed is a random token in the user prompt
   (`lib/generate.ts:77`, *"Variation token: …"*). An LLM cannot use a random
   string to know what it produced on previous independent calls, so it converges
   on the most salient British categories every time. The sibling Who's Who
   feature already solves this with a `recent[]` list
   (`lib/personality-service.ts:17-27`); Connections has **zero** dedup.
2. **Our own few-shot examples prime the repeats.** The frozen SYSTEM prompt
   hardcodes 8 anchor puzzles as the quality bar (`lib/generate.ts:39-48`); two of
   them are "London Underground lines" (VICTORIA/CENTRAL/JUBILEE/DISTRICT) and
   "NEW ___" (CASTLE/PORT/QUAY/BURY). The model treats these as the gold standard
   and reproduces them.
3. **The fallback pool is tiny and contains those same categories.** When
   generation fails validation twice, endless serves a *random* puzzle from just 8
   anchors (`lib/generate.ts:88`), which again include London Underground and NEW___.

## Goals

1. **A group, once served, is never served again** — permanent, group-level
   uniqueness (not a rolling recent-N window).
2. **New puzzles should be genuinely varied and good**, not just non-repeating.
3. Never break play: dedup is an enhancement, never a hard dependency.

Out of scope: per-player history / user identity (dedup is **global** — agreed),
daily mode (already non-repeating by design), and a fully curated offline deck
(approach C — deferred).

## Approach (chosen: B — verify + regenerate)

Keep generating live, but after generation **verify** the puzzle's groups against
a permanent store and **regenerate** on collision, rather than merely asking the
model to vary. Verification is what makes the guarantee hold.

### 1. The dedup unit and signature

- The unit is a **group** (one category = its 4 words), not the 16-word puzzle.
- A puzzle is served only if **all four** of its groups are novel.
- **Signature** = the 4 members, each lowercased + trimmed of surrounding
  whitespace, then sorted, joined with `|`, and hashed (stable string hash). Same
  four words in any order ⇒ same signature ⇒ already seen.
- The normalized **category name** is also stored, used only for *soft steering*
  (the prompt avoid-list). The hard block is on the member-set signature, because
  the model phrases names inconsistently.

### 2. The store — swappable repository

A thin interface so the backing store is a config change, never a rewrite:

```
interface ServedGroupsRepo {
  seen(signatures: string[]): Promise<Set<string>>;  // which of these already exist
  remember(groups: { sig: string; normName: string; members: string[] }[]): Promise<void>;
  recentNames(limit: number): Promise<string[]>;      // for the prompt avoid-list
}
```

- Default implementation: **MongoDB Atlas (free M0 tier)**, chosen because it is
  host-agnostic (works identically on Vercel or Railway, so hosting need not be
  decided now). Database `apol_games`, collection `served_groups`, documents
  `{ sig, normName, members[], createdAt }`, **unique index on `sig`**. No TTL —
  permanent. (`remember` uses an idempotent upsert on `sig` so a concurrent
  double-serve can't throw on the unique index.)
- Connection via the official `mongodb` driver behind a module-level singleton
  (cached across hot reloads / serverless invocations), reading `MONGODB_URI` from
  env.
- **Graceful degradation:** if `MONGODB_URI` is unset or the connection fails, the
  repository becomes a no-op (`seen` → empty set, `remember` → noop,
  `recentNames` → []). The game plays exactly as today (no dedup) instead of
  erroring. This is logged once.

### 3. The endless generation loop

Implemented in `lib/generate.ts` / `lib/puzzle-service.ts` (exact split decided in
the plan). On an endless request:

1. Build the user prompt with **(a)** a rotating "lean into this domain" theme seed
   and **(b)** an avoid-list of recently-served category names from
   `recentNames(~40)`.
2. Generate → validate structure (existing `validatePuzzle` / `normalisePuzzle`).
3. Compute the 4 group signatures; call `seen(signatures)`.
4. If **any** group is already seen → regenerate. Bounded to ~4 attempts total
   (reusing/extending the existing retry loop).
5. On a fully-novel puzzle → `remember` all 4 groups, then serve it.
6. If all attempts still collide ("novelty pressure") → serve the candidate with
   the **fewest already-seen groups**, `remember` only its novel groups, and
   **log it** (no silent cap; the player is never blocked).

**Prompt caching is preserved:** the SYSTEM block stays frozen and cached. The
dynamic avoid-list and theme seed go in the **user message**, which is already
where per-request variation lives.

### 4. Fixing the cause (priming) and improving novelty

This is what makes *new* puzzles good, not just non-repeating:

- **Stop priming on specific categories.** Add an explicit instruction that the
  anchor examples are *style references only* — match the trap density and format,
  but do **not** reuse their categories or themes (London Underground, NEW___,
  etc.).
- **Rotating curated domain list.** A module-level array of ~35 British cultural /
  wordplay domains (e.g. biscuits & sweets, motorways & A-roads, soap operas,
  cricket terms, rhyming slang, monarchs, seaside towns, pub names, cheeses,
  weather words, homophones, hidden-word & suffix wordplay, …). Each endless call
  randomly suggests 1–2 as flavor in the user prompt. Randomness varies per request
  via the existing seed; this actively pushes variety instead of letting the model
  fall back to defaults.
- **Fallback exemption.** The 8-anchor fallback is an error path only; under
  permanent dedup it cannot satisfy "never repeat," so it stays exempt (a rare
  repeat beats a 500). It should fire far less once generation is steered and
  retried.

### 5. Logging

Add a small connections logger (generalize `lib/log.ts`'s `wlog`, or add a sibling
with a `[connections]` prefix). One greppable line per outcome: `gen.ok`,
`gen.collision` (with attempt count), `novelty.pressure` (served despite
collisions), `repo.degraded` (Mongo unavailable).

## Testing

- **Unit — signature:** order-insensitive and case-insensitive collisions hash
  equal; trivially different members hash differently.
- **Unit — repository:** `seen` / `remember` / `recentNames` against an in-memory
  fake implementation of `ServedGroupsRepo`.
- **Loop:** seed the store with a known group, force the generator to emit a puzzle
  containing it, assert the loop regenerates and never serves the seeded group.
- **Degradation:** with the repo in no-op mode, the loop serves the first valid
  puzzle and never throws.
- **Manual/repro script:** hit endless N times and assert zero group-signature
  repeats across the run — the direct reproduction of the reported bug and the
  proof it is fixed.

## Consequence to acknowledge

Permanent uniqueness shrinks the pool of valid groups over time; eventually
fully-novel puzzles get harder and regeneration attempts rise. For the foreseeable
future (thousands of puzzles) British culture + wordplay is more than deep enough,
and step 6 degrades gracefully (serve + log) rather than failing. Sustained novelty
pressure is the signal to move to approach C (a curated, pre-vetted deck).

## Files likely touched

- `lib/generate.ts` — prompt changes (avoid-list, theme seed, anti-priming),
  signature computation, regenerate-on-collision loop.
- `lib/puzzle-service.ts` — wire endless path through the repo.
- `lib/served-groups.ts` (new) — `ServedGroupsRepo` interface + Mongo impl + no-op.
- `lib/mongo.ts` (new) — connection singleton.
- `lib/puzzle.ts` — possibly export a signature/normalization helper.
- `lib/log.ts` — connections logging.
- `.env` / env docs — `MONGODB_URI`.
- Tests + a repro script.

> Note: per `AGENTS.md`, this is a non-standard Next.js build — the relevant guide
> in `node_modules/next/dist/docs/` must be read before writing route/server code.
