# Apolitical Games — Design

**Date:** 2026-05-18

## Summary
A small game hub ("Apolitical Games") with a shared design system and two
games:

1. **Connections** — NYT-Connections-style word puzzle through a British
   cultural lens. Daily (shared, cached) + Endless. (Previously the whole
   app; now one game in the hub.)
2. **Who's Who** — guess a notable British public figure (politician,
   royal, artist, musician, athlete…) from a photo. Labelled input,
   5 attempts, progressive hints, lenient matching, endless play.

No database: no accounts, leaderboards, or persistence.

## Routes & structure
```
/                    Apolitical Games hub — game cards
/connections         Connections home (Daily / Endless)
/connections/play    the connections game (?mode=daily|endless)
/whos-who            Who's Who (endless)
/api/puzzle          Connections generation (unchanged)
/api/personality     Who's Who generation (new)
```
A shared `PageShell` (wordmark + back-to-hub + centred max-width container)
wraps every page so the hub and both games read as one product.

## Who's Who
- Claude picks a notable British figure and writes 5 graded hints (broad →
  specific) plus the exact Wikipedia article title and acceptable answers.
- The app fetches the photo + blurb from the **Wikipedia REST summary API**
  server-side (freely licensed; small "Photo: Wikipedia" credit linking the
  article). Requires a descriptive User-Agent.
- Validate person + image exist; retry once; fall back to a baked curated
  list of well-known British figures so the route never dead-ends. If even
  Wikipedia is unreachable, the game stays playable from hints with an
  image placeholder.
- 5 attempts. Hint 0 (broad) shown from the start; each wrong guess reveals
  the next hint. Lenient matching: case/punctuation/accent-insensitive,
  accepts full name, provided answer variants, or the surname.
- Endless only — no daily, no cache. Sonnet 4.6, same robustness pattern
  as Connections.

## UX / visual system
- 8px spacing scale (8/16/24/32); one centred container (max-width ~560px);
  consistent vertical rhythm and alignment on every screen.
- Serif display titles (Georgia) + system-sans body; neutral base
  (white / ink #121212); each game keeps its own accent.
- Hub: equal-sized game cards in a responsive grid — title, one-line
  description, hover/focus states, identical padding/alignment; one column
  on mobile.
- Shared primitives: buttons, spinner, toast, disabled states, ≥44px touch
  targets, visible focus rings, labelled inputs.

## Pure, tested logic
- `lib/connections.ts` (existing) — unchanged engine + tests.
- `lib/personality.ts` — types, structural validator, **pure lenient
  name-matching** (unit-tested), baked fallback figures.

## Process note
User approved this design and asked to build directly with best judgement.
Formal writing-plans / spec-review gates streamlined per that standing
instruction; this document is the design record.
