// Server-only: produce a ready-to-play Who's Who round — a personality plus
// a usable Wikipedia photo. Endless mode, no caching.

import "server-only";
import { generatePersonality, fallbackFigure } from "./personality-generate";
import { fetchWikiInfo } from "./wikipedia";
import {
  FALLBACK_FIGURES,
  type Personality,
  type Round,
} from "./personality";
import { wlog } from "./log";

export type { Round };

// Server-instance memory (no DB): the last N served names, so we can both
// tell the model what to avoid and reject a repeat if it ignores us.
const RECENT_MAX = 40;
const recent: string[] = [];
function remember(name: string) {
  if (!recent.includes(name)) recent.push(name);
  while (recent.length > RECENT_MAX) recent.shift();
}

// Rotate the requested field every call so the model can't sit on one
// cluster. Offset start randomly so restarts don't always begin the same.
const FIELDS = [
  "politics or government",
  "music",
  "science, medicine or invention",
  "sport or the Olympics",
  "literature (author or poet)",
  "comedy",
  "film or television acting",
  "royalty or the aristocracy",
  "a pre-1900 historical figure",
  "art, fashion or design",
  "broadcasting or presenting",
  "business, exploration or activism",
];
let fieldCursor = Math.floor(Math.random() * FIELDS.length);
function nextField(): string {
  const f = FIELDS[fieldCursor % FIELDS.length];
  fieldCursor += 1;
  return f;
}

function toRound(
  p: Personality,
  wiki: Awaited<ReturnType<typeof fetchWikiInfo>>,
  source: Round["source"]
): Round {
  return {
    name: p.name,
    category: p.category,
    hints: p.hints,
    acceptableAnswers: p.acceptableAnswers,
    blurb: wiki?.extract ?? "",
    image: wiki ? { url: wiki.imageUrl, pageUrl: wiki.pageUrl } : null,
    source,
  };
}

export async function getRound(): Promise<Round> {
  let aiTries = 0;

  // Up to 3 AI candidates; accept the first that is fresh AND has a photo.
  for (let i = 0; i < 3; i++) {
    const field = nextField();
    const p = await generatePersonality(field, recent);
    if (!p) break; // generation unavailable (e.g. no API key) — go to fallback
    aiTries++;
    if (recent.includes(p.name)) {
      wlog("ai.dup_rejected", { name: p.name, field });
      continue; // model ignored the avoid-list — try again
    }
    const wiki = await fetchWikiInfo(p.wikipediaTitle);
    if (wiki) {
      remember(p.name);
      wlog("result", { source: "ai", name: p.name, field, aiTries });
      return toRound(p, wiki, "ai");
    }
    wlog("ai.wiki_miss", { name: p.name, title: p.wikipediaTitle });
  }

  // Fallback: try a few baked figures (their pages reliably have photos).
  const tried = new Set<string>();
  for (let i = 0; i < 3; i++) {
    const p = fallbackFigure();
    if (tried.has(p.name)) continue;
    tried.add(p.name);
    const wiki = await fetchWikiInfo(p.wikipediaTitle);
    if (wiki) {
      remember(p.name);
      wlog("result", { source: "fallback", name: p.name, aiTries });
      return toRound(p, wiki, "fallback");
    }
  }

  // Even Wikipedia is unreachable — still playable from hints, no image.
  wlog("result", { source: "fallback", name: FALLBACK_FIGURES[0].name, aiTries, noImage: true });
  return toRound(FALLBACK_FIGURES[0], null, "fallback");
}
