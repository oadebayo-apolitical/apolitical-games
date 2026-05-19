// Types, structural validation, pure name-matching, and the baked fallback
// roster for "Who's Who". No server-only imports — safe to use client-side.

export interface Personality {
  /** Canonical display name, e.g. "David Attenborough". */
  name: string;
  /** Exact English Wikipedia article title used to fetch the photo. */
  wikipediaTitle: string;
  /** Short label, e.g. "Naturalist & broadcaster". */
  category: string;
  /** 5 hints, broad → specific. Must NOT contain the surname/full name. */
  hints: string[];
  /** Extra accepted spellings/variants the player might type. */
  acceptableAnswers: string[];
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

// A ready-to-play round sent to the client (client-safe shape).
export interface Round {
  name: string;
  category: string;
  hints: string[];
  acceptableAnswers: string[];
  blurb: string;
  image: { url: string; pageUrl: string } | null;
  source: "ai" | "fallback";
}

const HONORIFICS =
  /^(sir|dame|lord|lady|dr|doctor|rt hon|the rt hon|mr|mrs|ms|prof|professor)\s+/;

/** lower-case, strip accents, drop punctuation, collapse spaces. */
function stripCombining(s: string): string {
  return s.replace(/[\u0300-\u036f]/g, "");
}

export function normalise(s: string): string {
  return stripCombining(s.normalize("NFD"))
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHonorific(n: string): string {
  return n.replace(HONORIFICS, "").trim();
}

type Nameable = Pick<Personality, "name" | "acceptableAnswers">;

/** The set of normalised strings that count as a correct answer. */
export function acceptedAnswers(p: Nameable): Set<string> {
  const out = new Set<string>();
  const add = (raw: string) => {
    const n = normalise(raw);
    if (n) out.add(n);
    const stripped = stripHonorific(n);
    if (stripped && stripped !== n) out.add(stripped);
  };
  add(p.name);
  for (const a of p.acceptableAnswers) add(a);
  // Surname (last token) — accept it on its own if it's distinctive enough.
  const tokens = stripHonorific(normalise(p.name)).split(" ");
  const surname = tokens[tokens.length - 1];
  if (surname && surname.length >= 3 && tokens.length > 1) out.add(surname);
  return out;
}

/**
 * Same human? Used client-side to guarantee "Next person" always changes
 * the face — server dedup is best-effort (per-instance, race-prone), so the
 * UI must not trust it. Exact normalised-name match plus a containment check
 * so "Princess Margaret" and "Princess Margaret, Countess of Snowdon" count
 * as the same person.
 */
export function isSamePerson(a: string, b: string): boolean {
  const x = normalise(a);
  const y = normalise(b);
  if (!x || !y) return false;
  return x === y || x.startsWith(y + " ") || y.startsWith(x + " ");
}

/**
 * Same human across two {name, wikipediaTitle} records. The Wikipedia
 * article title is the strongest identity signal (canonical per person),
 * so a match on EITHER the fuzzy name or the fuzzy title counts. This
 * catches same-person-different-string repeats the raw-string server check
 * missed, e.g. name "Princess Margaret" vs "Princess Margaret, Countess of
 * Snowdon", or title "Robert Lindsay (actor)" vs "Robert Lindsay".
 */
export function sameIdentity(
  a: { name: string; wikipediaTitle: string },
  b: { name: string; wikipediaTitle: string }
): boolean {
  return (
    isSamePerson(a.name, b.name) ||
    isSamePerson(a.wikipediaTitle, b.wikipediaTitle)
  );
}

/** Lenient correctness check used by the UI. */
export function isCorrectGuess(guess: string, p: Nameable): boolean {
  const g = normalise(guess);
  if (!g) return false;
  const accepted = acceptedAnswers(p);
  return accepted.has(g) || accepted.has(stripHonorific(g));
}

export function validatePersonality(value: unknown): ValidationResult {
  if (typeof value !== "object" || value === null) {
    return { ok: false, error: "not an object" };
  }
  const p = value as Record<string, unknown>;
  for (const key of ["name", "wikipediaTitle", "category"]) {
    if (typeof p[key] !== "string" || (p[key] as string).trim() === "") {
      return { ok: false, error: `missing/empty "${key}"` };
    }
  }
  if (
    !Array.isArray(p.hints) ||
    p.hints.length < 4 ||
    p.hints.some((h) => typeof h !== "string" || h.trim() === "")
  ) {
    return { ok: false, error: "hints must be 4+ non-empty strings" };
  }
  if (
    !Array.isArray(p.acceptableAnswers) ||
    p.acceptableAnswers.some((a) => typeof a !== "string")
  ) {
    return { ok: false, error: "acceptableAnswers must be a string array" };
  }
  // A hint must never give the surname away.
  const surname = normalise(p.name as string).split(" ").pop() ?? "";
  if (
    surname.length >= 3 &&
    (p.hints as string[]).some((h) => normalise(h).split(" ").includes(surname))
  ) {
    return { ok: false, error: "a hint leaks the surname" };
  }
  return { ok: true };
}

/** Trim/normalise a validated-ish value to exactly 5 hints. */
export function normalisePersonality(p: Personality): Personality {
  const hints = p.hints.map((h) => h.trim()).slice(0, 5);
  while (hints.length < 5) hints.push(hints[hints.length - 1]);
  return {
    name: p.name.trim(),
    wikipediaTitle: p.wikipediaTitle.trim(),
    category: p.category.trim(),
    hints,
    acceptableAnswers: p.acceptableAnswers.map((a) => a.trim()),
  };
}

// Well-known British figures whose Wikipedia pages reliably carry a photo —
// used as few-shot anchors AND the offline fallback roster.
export const FALLBACK_FIGURES: Personality[] = [
  {
    name: "David Attenborough",
    wikipediaTitle: "David Attenborough",
    category: "Naturalist & broadcaster",
    hints: [
      "A broadcaster known worldwide for natural-history programmes",
      "Has narrated landmark BBC wildlife series since the 1970s",
      "Voice of Planet Earth and Blue Planet",
      "Brother was the film director and actor Richard",
      "First name David",
    ],
    acceptableAnswers: ["attenborough", "david attenborough"],
  },
  {
    name: "Queen Elizabeth II",
    wikipediaTitle: "Elizabeth II",
    category: "Monarch",
    hints: [
      "A British head of state for over seven decades",
      "Acceded to the throne in 1952",
      "Had a Platinum Jubilee in 2022",
      "Mother of King Charles III",
      "Regnal name Elizabeth",
    ],
    acceptableAnswers: [
      "elizabeth ii",
      "queen elizabeth",
      "queen elizabeth ii",
      "elizabeth",
    ],
  },
  {
    name: "David Bowie",
    wikipediaTitle: "David Bowie",
    category: "Musician",
    hints: [
      "An enormously influential British rock musician",
      "Active from the late 1960s until the 2010s",
      "Created the alter ego Ziggy Stardust",
      "Sang 'Heroes' and 'Life on Mars?'",
      "First name David",
    ],
    acceptableAnswers: ["bowie", "david bowie"],
  },
  {
    name: "Mo Farah",
    wikipediaTitle: "Mo Farah",
    category: "Long-distance runner",
    hints: [
      "A British Olympic track athlete",
      "Dominant in distance running through the 2010s",
      "Double-double Olympic champion at 5,000m and 10,000m",
      "Famous for the 'Mobot' celebration",
      "First name Mo",
    ],
    acceptableAnswers: ["mo farah", "farah", "mohamed farah"],
  },
  {
    name: "Adele",
    wikipediaTitle: "Adele",
    category: "Singer-songwriter",
    hints: [
      "A British singer with a powerful soul voice",
      "Rose to fame around 2008–2011",
      "Albums named after her ages: 19, 21, 25, 30",
      "Sang 'Someone Like You' and 'Hello'",
      "Mononymous — first name only",
    ],
    acceptableAnswers: ["adele", "adele adkins"],
  },
  {
    name: "Winston Churchill",
    wikipediaTitle: "Winston Churchill",
    category: "Wartime Prime Minister",
    hints: [
      "A 20th-century British Prime Minister",
      "Led the country during the Second World War",
      "Known for the 'we shall fight on the beaches' speech",
      "Also a Nobel laureate in Literature",
      "First name Winston",
    ],
    acceptableAnswers: ["churchill", "winston churchill"],
  },
  {
    name: "Lewis Hamilton",
    wikipediaTitle: "Lewis Hamilton",
    category: "Formula One driver",
    hints: [
      "A British motorsport champion",
      "Competing at the top level since 2007",
      "Seven-time Formula One world champion",
      "Long associated with the Mercedes team",
      "First name Lewis",
    ],
    acceptableAnswers: ["hamilton", "lewis hamilton"],
  },
  {
    name: "Judi Dench",
    wikipediaTitle: "Judi Dench",
    category: "Actor",
    hints: [
      "A celebrated British stage and screen actor",
      "A leading figure on stage and film for decades",
      "Played M in several James Bond films",
      "Won an Oscar for Shakespeare in Love",
      "First name Judi",
    ],
    acceptableAnswers: ["judi dench", "dench", "dame judi dench"],
  },
];
