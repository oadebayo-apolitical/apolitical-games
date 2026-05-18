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

export type { Round };

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
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Up to 2 AI candidates; accept the first whose Wikipedia page has a photo.
  for (let i = 0; i < 2; i++) {
    const p = await generatePersonality(`${seed}-${i}`);
    if (!p) break; // generation unavailable (e.g. no API key) — go to fallback
    const wiki = await fetchWikiInfo(p.wikipediaTitle);
    if (wiki) return toRound(p, wiki, "ai");
  }

  // Fallback: try a few baked figures (their pages reliably have photos).
  const tried = new Set<string>();
  for (let i = 0; i < 3; i++) {
    const p = fallbackFigure();
    if (tried.has(p.name)) continue;
    tried.add(p.name);
    const wiki = await fetchWikiInfo(p.wikipediaTitle);
    if (wiki) return toRound(p, wiki, "fallback");
  }

  // Even Wikipedia is unreachable — still playable from hints, no image.
  return toRound(FALLBACK_FIGURES[0], null, "fallback");
}
