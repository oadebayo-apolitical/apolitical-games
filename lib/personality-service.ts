// Server-only: produce a ready-to-play Who's Who round. The person is
// chosen from the Wikidata-sourced deck (guaranteed real + has a P18 photo);
// the model only writes the clues. We verify a photo actually loads before
// committing, and dedup globally via MongoDB so people don't repeat.

import "server-only";
import { writeProfile, fallbackFigure } from "./personality-generate";
import { fetchExtract } from "./wikipedia";
import { DECK, deckImageUrl, pickFromDeck } from "./deck";
import { getServedPeople } from "./served-people-mongo";
import type { Round } from "./personality";
import { wlog } from "./log";

export type { Round };

// Per-instance guard: the last N qids served by THIS process. Keeps degraded
// (no-Mongo) mode from repeating, and avoids reshowing the very last people
// before a Mongo write is reflected in the next request's served set.
const RECENT_MAX = 60;
const recent: string[] = [];
function rememberLocal(qid: string) {
  if (!recent.includes(qid)) recent.push(qid);
  while (recent.length > RECENT_MAX) recent.shift();
}

const wikiPage = (title: string) =>
  `https://en.wikipedia.org/wiki/${encodeURIComponent(
    title.replace(/\s+/g, "_")
  )}`;

export async function getRound(): Promise<Round> {
  const repo = getServedPeople();
  const served = await repo.servedQids();
  const exhausted = served.size >= DECK.length;

  // Up to 4 candidates; accept the first with a working photo AND clues.
  for (let i = 0; i < 4; i++) {
    let person = pickFromDeck(
      (e) => served.has(e.qid) || recent.includes(e.qid)
    );
    if (exhausted) {
      // Whole deck served — recycle the least-recently-seen person instead.
      const qid = await repo.oldestServedQid(recent);
      person = DECK.find((e) => e.qid === qid) ?? person;
    }

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

    // The browser loads the photo (from the user's IP, not our shared server
    // IP, which Wikimedia rate-limits). Prefer the Wikipedia CDN thumbnail;
    // the client falls back to the deck's Special:FilePath, then a placeholder.
    const deckUrl = deckImageUrl(person);
    const image = extract?.thumbUrl
      ? { url: extract.thumbUrl, fallbackUrl: deckUrl }
      : { url: deckUrl, fallbackUrl: null };

    await repo.remember({
      qid: person.qid,
      name: person.name,
      title: person.title,
    });
    rememberLocal(person.qid);
    wlog("result", { source: "deck", name: person.name, attempt: i + 1 });
    return {
      name: person.name,
      category: profile.category,
      hints: profile.hints,
      acceptableAnswers: profile.acceptableAnswers,
      blurb: extract?.extract ?? "",
      image: {
        ...image,
        pageUrl: extract?.pageUrl ?? wikiPage(person.title),
      },
      source: "ai",
    };
  }

  // Model/photo unavailable for every attempt — baked roster keeps it playable.
  // No deck photo for these; the game still works from the hints.
  const fb = fallbackFigure();
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
