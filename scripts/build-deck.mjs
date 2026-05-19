// Build the Who's Who deck from Wikidata.
//
// Selects notable British *humans* who HAVE a portrait image (P18) and an
// English Wikipedia article, ranked by sitelink count (a good proxy for
// public recognisability). Writes lib/whos-who-deck.json.
//
// Run periodically to refresh:  node scripts/build-deck.mjs
//
// Decoupling "who to show" from the LLM and grounding it in Wikidata is the
// point: P18 guarantees a real photo exists, so the runtime never has to
// guess a Wikipedia title or hope a thumbnail is present.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "lib", "whos-who-deck.json");
const TARGET = 1000; // final deck size cap

// British state entities for citizenship (P27) — covers modern + historical.
const CITIZENSHIP = [
  "wd:Q145", // United Kingdom
  "wd:Q174193", // UK of Great Britain and Ireland
  "wd:Q161885", // Kingdom of Great Britain
  "wd:Q179876", // Kingdom of England
  "wd:Q170072", // Kingdom of Scotland
];

// Lean query: no label service (we derive the name from the enwiki title),
// high sitelink floor to keep the working set small enough for WDQS's 60s
// limit. ORDER BY over the floored set is what makes/breaks it.
const QUERY = `
SELECT ?item ?article ?image ?sl WHERE {
  ?item wdt:P31 wd:Q5 ;
        wdt:P18 ?image ;
        wikibase:sitelinks ?sl .
  FILTER(?sl >= 45)
  VALUES ?cit { ${CITIZENSHIP.join(" ")} }
  ?item wdt:P27 ?cit .
  # Exclude colonials / naturalised non-Brits (e.g. George Washington was a
  # subject of the Kingdom of GB; Jimmy Wales is a naturalised UK citizen).
  MINUS { ?item wdt:P27 wd:Q30 }
  ?article schema:about ?item ;
           schema:isPartOf <https://en.wikipedia.org/> .
}
ORDER BY DESC(?sl)
LIMIT 1500`;

const UA =
  "ApoliticalGames/1.0 (https://apolitical.co; internal team game) deck-builder";

function titleFromArticle(url) {
  const slug = url.split("/wiki/")[1] ?? "";
  return decodeURIComponent(slug).replace(/_/g, " ");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function queryWDQS() {
  const endpoint =
    "https://query.wikidata.org/sparql?format=json&query=" +
    encodeURIComponent(QUERY);
  for (let attempt = 1; attempt <= 4; attempt++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 58000);
    try {
      console.log(`Querying WDQS (attempt ${attempt})…`);
      const res = await fetch(endpoint, {
        headers: {
          "User-Agent": UA,
          Accept: "application/sparql-results+json",
        },
        signal: ctl.signal,
      });
      if (res.ok) return await res.json();
      const body = await res.text().catch(() => "");
      console.warn(`  WDQS ${res.status} (retrying): ${body.slice(0, 120)}`);
    } catch (e) {
      console.warn(`  request failed (retrying): ${e}`);
    } finally {
      clearTimeout(t);
    }
    await sleep(8000 * attempt);
  }
  throw new Error("WDQS unavailable after 4 attempts");
}

async function main() {
  const json = await queryWDQS();
  const rows = json.results.bindings;
  console.log(`Got ${rows.length} rows.`);

  const byQid = new Map();
  for (const r of rows) {
    const qid = r.item.value.split("/").pop();
    if (byQid.has(qid)) continue; // first = highest sitelinks (ordered desc)
    const title = titleFromArticle(r.article.value);
    if (!title) continue;
    // Display name = article title minus any "(disambiguator)"; the full
    // title is kept for fetching the Wikipedia extract.
    const name = title.replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (!name) continue;
    byQid.set(qid, {
      qid,
      name,
      title,
      image: r.image.value, // Commons Special:FilePath URL
      sitelinks: Number(r.sl.value),
    });
  }

  const deck = [...byQid.values()].slice(0, TARGET);
  writeFileSync(OUT, JSON.stringify(deck, null, 0) + "\n");
  console.log(`Wrote ${deck.length} people → ${OUT}`);
  console.log(
    "Top 15:",
    deck
      .slice(0, 15)
      .map((d) => d.name)
      .join(", ")
  );
  console.log(
    "Random 15:",
    [...deck]
      .sort(() => Math.random() - 0.5)
      .slice(0, 15)
      .map((d) => d.name)
      .join(", ")
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
