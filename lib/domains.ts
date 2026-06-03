// Curated British cultural / wordplay domains. The endless generator is nudged
// toward a couple of these each round so it stops defaulting to the same handful
// of categories (London Underground, NEW___, football...). Inspiration, not law;
// the never-repeat guarantee is enforced separately by group signatures.
export const DOMAINS: string[] = [
  "biscuits and sweets",
  "motorways and A-roads",
  "soap operas",
  "cricket terms",
  "cockney rhyming slang",
  "monarchs and royal houses",
  "seaside and coastal towns",
  "pub names and pub games",
  "British cheeses",
  "weather and types of rain",
  "homophones",
  "hidden words inside longer words",
  "shared prefixes (X ___)",
  "shared suffixes (___ X)",
  "British sitcoms and panel shows",
  "puddings and desserts",
  "garden birds and wildlife",
  "rivers and lochs",
  "counties and shires",
  "tea and biscuit culture",
  "snooker and darts",
  "rugby and its positions",
  "British slang for money",
  "school and exam terms",
  "market and high-street shops",
  "trains and railway stations",
  "castles and stately homes",
  "folk customs and festivals",
  "British inventors and scientists",
  "musicians and bands",
  "playwrights and authors",
  "classic British car marques",
  "fish and chips and takeaway food",
  "regional dialect words",
  "nursery rhymes and playground games",
];

/**
 * Pick `n` distinct domains deterministically from a seed string, using a small
 * LCG so the same seed always yields the same picks (testable) while different
 * per-request seeds spread across the list.
 */
export function pickDomains(seed: string, n: number): string[] {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  let x = Math.abs(h) || 1;
  const used = new Set<number>();
  const out: string[] = [];
  const want = Math.min(n, DOMAINS.length);
  while (out.length < want) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const i = x % DOMAINS.length;
    if (!used.has(i)) {
      used.add(i);
      out.push(DOMAINS[i]);
    }
  }
  return out;
}
