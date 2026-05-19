// Server-only: produce a ready-to-play Who's Who round. The person is
// chosen from the Wikidata-sourced deck (guaranteed real + has a P18
// photo); the model only writes the clues for that verified person.
// Endless mode, no caching.

import "server-only";
import { writeProfile, fallbackFigure } from "./personality-generate";
import { fetchExtract } from "./wikipedia";
import { DECK, deckImageUrl, pickFromDeck } from "./deck";
import { sameIdentity, type Round } from "./personality";
import { wlog } from "./log";

export type { Round };

// Server-instance memory (no DB): the last N served identities, so we don't
// repeat a person (deck pick is filtered through this).
const RECENT_MAX = 60;
type Id = { name: string; wikipediaTitle: string };
const recent: Id[] = [];

function isRecent(p: Id): boolean {
  return recent.some((r) => sameIdentity(r, p));
}
function remember(p: Id) {
  if (!isRecent(p)) recent.push(p);
  while (recent.length > RECENT_MAX) recent.shift();
}

const wikiPage = (title: string) =>
  `https://en.wikipedia.org/wiki/${encodeURIComponent(
    title.replace(/\s+/g, "_")
  )}`;

export async function getRound(): Promise<Round> {
  // Up to 3 deck people; accept the first the model can write clues for.
  for (let i = 0; i < 3; i++) {
    const person = pickFromDeck(isRecent);
    const extract = await fetchExtract(person.title);
    const profile = await writeProfile(
      person.name,
      person.title,
      extract?.extract ?? ""
    );
    if (!profile) {
      wlog("profile_miss", { name: person.name });
      continue; // model unavailable/invalid — try another deck person
    }
    remember({ name: person.name, wikipediaTitle: person.title });
    wlog("result", { source: "deck", name: person.name, attempt: i + 1 });
    return {
      name: person.name,
      category: profile.category,
      hints: profile.hints,
      acceptableAnswers: profile.acceptableAnswers,
      blurb: extract?.extract ?? "",
      image: {
        url: deckImageUrl(person),
        pageUrl: extract?.pageUrl ?? wikiPage(person.title),
      },
      source: "ai",
    };
  }

  // Model unavailable (e.g. no API key) — baked roster keeps it playable.
  // No deck photo for these; the game still works from the hints.
  const fb = fallbackFigure();
  remember({ name: fb.name, wikipediaTitle: fb.wikipediaTitle });
  wlog("result", { source: "fallback", name: fb.name, deck: DECK.length });
  return {
    name: fb.name,
    category: fb.category,
    hints: fb.hints,
    acceptableAnswers: fb.acceptableAnswers,
    blurb: "",
    image: null,
    source: "fallback",
  };
}
