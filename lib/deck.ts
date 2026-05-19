// The Who's Who deck: notable British people sourced from Wikidata, each
// guaranteed to be a real human with a portrait image (P18) and an English
// Wikipedia article. Refresh with `node scripts/build-deck.mjs`.

import deckData from "./whos-who-deck.json";

export interface DeckEntry {
  qid: string;
  name: string; // display name (article title minus disambiguator)
  title: string; // exact enwiki article title (for the extract lookup)
  image: string; // Wikidata P18 — a Commons Special:FilePath URL
  sitelinks: number;
}

export const DECK: DeckEntry[] = deckData as DeckEntry[];

/** A sensibly-sized https image URL for an entry's P18 photo. */
export function deckImageUrl(e: DeckEntry): string {
  // P18 is a Commons Special:FilePath URL; force https + cap the width.
  const https = e.image.replace(/^http:/, "https:");
  return https + (https.includes("?") ? "&" : "?") + "width=640";
}

/**
 * Pick a person not matching `isRecent`. Tries random draws first (fast,
 * uniform), then scans for any fresh entry, then gives up and returns a
 * random one so the game never dead-ends.
 */
export function pickFromDeck(
  isRecent: (e: { name: string; wikipediaTitle: string }) => boolean
): DeckEntry {
  const asId = (e: DeckEntry) => ({ name: e.name, wikipediaTitle: e.title });
  for (let i = 0; i < 25; i++) {
    const e = DECK[Math.floor(Math.random() * DECK.length)];
    if (!isRecent(asId(e))) return e;
  }
  const fresh = DECK.filter((e) => !isRecent(asId(e)));
  if (fresh.length > 0) {
    return fresh[Math.floor(Math.random() * fresh.length)];
  }
  return DECK[Math.floor(Math.random() * DECK.length)];
}
