# British Connections — Design (v2: Next.js + live AI)

**Date:** 2026-05-18

## Summary
A faithful NYT Connections clone localised through a British cultural lens
(normal Connections puzzles — categories, synonyms, wordplay, pop culture —
but any reference that would default to American is British instead). Now a
deployable Next.js app on Vercel with live AI puzzle generation and a shared
daily puzzle for teammates.

## Stack
Next.js (App Router, TypeScript), `@anthropic-ai/sdk`, deployed to Vercel.
Pure game logic kept in framework-free, unit-tested modules.

## Structure
```
app/
  page.tsx            home: choose Daily or Endless
  play/page.tsx       game screen (client) — ?mode=daily|endless
  api/puzzle/route.ts server: Claude call, validation, caching
lib/
  generate.ts         prompt + Claude call + schema validation + retry
  connections.ts      pure game logic (selection, scoring, one-away, reveal)
  puzzle.ts           Puzzle types + structural validator + anchor pool
components/           Grid, SolvedGroup, EndScreen, Loading, Mistakes
```

## AI generation (`/api/puzzle`, server-only)
- Holds `ANTHROPIC_API_KEY` (Vercel env var, never reaches the browser).
- Prompt engineered for the British-lens Connections format: 4 groups of 4,
  staggered difficulty (yellow→purple), deliberate cross-group overlap traps,
  British spelling/references, no Americanisms. The 8 hand-authored puzzles
  serve as few-shot anchors.
- Server validates every response (16 unique words, 4 groups, levels 0–3);
  retries once on malformed output; falls back to an anchor puzzle if both
  attempts fail.
- Prompt caching on the static system/rules block (per claude-api skill).
- Models: Opus 4.7 for Daily (once/day, quality), Sonnet 4.6 for Endless
  (frequent, fast, cheap).

## Daily (shared, no database)
`?mode=daily` wrapped in Vercel Data Cache keyed to the UTC date,
revalidating at end of day → generated once, served identically to everyone.
Route pinned to a single region + low temperature + date-seeded prompt to
minimise the residual risk that a multi-region cold-cache miss regenerates.
Documented caveat: without a DB this risk is very low but not exactly zero;
a regenerated puzzle will be near-identical due to seeding + low temp.
Endless mode bypasses the cache — fresh puzzle every request.

## Mechanics
Faithful NYT rules ported to React: 4×4 grid, select 4 → submit, 4 mistakes,
"one away…", shuffle, deselect, ordered reveal (yellow→green→blue→purple),
win/lose end screen with coloured-square result grid. Loading state during
generation; error/retry state on failure.

## Participation with no storage (Wordle model)
Everyone gets the same Daily puzzle; end screen has a Share button copying a
spoiler-free result block + the deploy URL to paste in team chat. No
accounts, no leaderboard, no server-side scores. Refresh allows replay of
the daily (no one-attempt lock without storage) — accepted.

## Out of scope
Auth, leaderboards, persistence, streaks.

## Process note
User explicitly approved this design and asked to build directly with best
judgement and no further questions. Formal writing-plans / spec-review
gates are deliberately streamlined per that instruction; this document is
the design record. Pure game logic is built test-first (TDD); React UI is
built directly. claude-api skill consulted for the SDK integration.
