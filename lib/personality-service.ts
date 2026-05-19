// Server-only: produce a ready-to-play Who's Who round — a personality plus
// a usable Wikipedia photo. Endless mode, no caching.

import "server-only";
import { generatePersonality, fallbackFigure } from "./personality-generate";
import { fetchWikiInfo } from "./wikipedia";
import {
  FALLBACK_FIGURES,
  sameIdentity,
  type Personality,
  type Round,
} from "./personality";
import { wlog } from "./log";

export type { Round };

// Server-instance memory (no DB): the last N served *identities*
// (name + Wikipedia title), so we can tell the model what to avoid AND
// reject a repeat by identity even when it comes back as a different
// string (e.g. a title-extended name variant).
const RECENT_MAX = 40;
type Id = { name: string; wikipediaTitle: string };
const recent: Id[] = [];

function isRecent(p: Id): boolean {
  return recent.some((r) => sameIdentity(r, p));
}
function remember(p: Id) {
  if (!isRecent(p)) recent.push({ name: p.name, wikipediaTitle: p.wikipediaTitle });
  while (recent.length > RECENT_MAX) recent.shift();
}
// Human-readable avoid-list for the prompt.
function recentNames(): string[] {
  return recent.map((r) => r.name);
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

  // Up to 3 AI candidates; accept the first that is a fresh identity AND
  // has a photo.
  for (let i = 0; i < 3; i++) {
    const field = nextField();
    const p = await generatePersonality(field, recentNames());
    if (!p) break; // generation unavailable (e.g. no API key) — go to fallback
    aiTries++;
    if (isRecent(p)) {
      wlog("ai.dup_rejected", { name: p.name, title: p.wikipediaTitle, field });
      continue; // same identity as a recent one — try again
    }
    const wiki = await fetchWikiInfo(p.wikipediaTitle);
    if (wiki) {
      remember(p);
      wlog("result", { source: "ai", name: p.name, field, aiTries });
      return toRound(p, wiki, "ai");
    }
    wlog("ai.wiki_miss", { name: p.name, title: p.wikipediaTitle });
  }

  // Fallback: try baked figures, skipping any recently-served identity.
  const tried = new Set<string>();
  for (let i = 0; i < FALLBACK_FIGURES.length; i++) {
    const p = fallbackFigure();
    if (tried.has(p.name) || isRecent(p)) continue;
    tried.add(p.name);
    const wiki = await fetchWikiInfo(p.wikipediaTitle);
    if (wiki) {
      remember(p);
      wlog("result", { source: "fallback", name: p.name, aiTries });
      return toRound(p, wiki, "fallback");
    }
  }

  // Even Wikipedia is unreachable — still playable from hints, no image.
  wlog("result", { source: "fallback", name: FALLBACK_FIGURES[0].name, aiTries, noImage: true });
  return toRound(FALLBACK_FIGURES[0], null, "fallback");
}
