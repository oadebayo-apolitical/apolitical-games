# British Connections

NYT-Connections-style word puzzle, localised through a British cultural lens —
same game (categories, synonyms, wordplay), but wherever a reference would
default to American it's British instead. Puzzles are generated live by Claude.

## Modes

- **Daily** — one puzzle per UTC day, the same for everyone. Generated once and
  served from Vercel Data Cache, so the whole team plays the identical puzzle.
  Share your spoiler-free result grid in a chat (Wordle-style).
- **Endless** — a freshly generated puzzle on demand, as many as you like.

No database: there are no accounts, leaderboards, or stored scores, and
refreshing lets you replay the daily.

## Stack

Next.js (App Router) · TypeScript · `@anthropic-ai/sdk` · deploy on Vercel.

| Path | Role |
| --- | --- |
| `lib/connections.ts` | Pure game engine (selection, scoring, one-away, reveal). Unit-tested. |
| `lib/puzzle.ts` | Puzzle types, structural validator, hand-authored anchor pool. |
| `lib/generate.ts` | Claude call: prompt, structured output, validation, retry, fallback. Server-only. |
| `lib/puzzle-service.ts` | Daily caching + mode dispatch. Server-only. |
| `app/api/puzzle/route.ts` | Client-triggered reloads (New puzzle / Try again). |
| `app/play/Game.tsx` | Game UI. |

Models: **Opus 4.7** for the daily (quality, once a day), **Sonnet 4.6** for
endless (fast, cheap). The static rules + few-shot anchors are prompt-cached.
Every generated puzzle is structurally validated server-side; on two failures
it falls back to a vetted hand-authored puzzle, so the route never 500s.

## Setup

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

Without a key the app still runs — it serves vetted fallback puzzles
(`source: "fallback"` in the API response) instead of AI-generated ones.

## Deploy (Vercel)

1. Push to a Git remote and import the repo in Vercel.
2. Add `ANTHROPIC_API_KEY` under Project Settings → Environment Variables.
3. Deploy. Share the URL with your team — the Daily tab is the shared puzzle.

> The daily route is pinned to one region (`preferredRegion = "iad1"`) so a
> cold cache in a second region is very unlikely to regenerate the day's
> puzzle. Without a database this can't be guaranteed to exactly zero.

## Test

```bash
npx vitest run        # pure game-engine tests
npm run build         # typecheck + production build
```

## Design

See `docs/superpowers/specs/2026-05-18-british-connections-design.md`. The
original static-HTML prototype is preserved at `docs/prototype/index.html`.
