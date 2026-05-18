// Server-only: ask Claude to pick a notable British public figure and write
// graded hints. Structurally validated; falls back to the baked roster.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  validatePersonality,
  normalisePersonality,
  FALLBACK_FIGURES,
  type Personality,
} from "./personality";

const client = new Anthropic();
const MODEL = "claude-sonnet-4-6";

const SYSTEM = `You run "Who's Who", a guess-the-British-public-figure game. Pick ONE notable British person — politician, monarch/royal, actor, musician, author, scientist, athlete, broadcaster, historical or contemporary. Vary widely across fields and eras; favour people the general British public would plausibly recognise.

Return JSON matching the schema:
- name: the canonical full name (e.g. "David Attenborough").
- wikipediaTitle: the EXACT English Wikipedia article title for this person (must be a real article that has a photograph). Use the real title, e.g. "Elizabeth II", not "Queen Elizabeth II".
- category: a short role label (e.g. "Naturalist & broadcaster", "Prime Minister", "Footballer").
- hints: EXACTLY 5 hints, ordered broad → specific. Hint 1 is vague (field only); each later hint is more revealing; hint 5 is very giveaway-level (e.g. their first name only). CRITICAL: no hint may contain the person's surname or full name.
- acceptableAnswers: lower-case ways a player might reasonably type the answer (surname alone, full name, well-known variants/nicknames).

Reference examples (style/quality bar — do not reuse these people):
${FALLBACK_FIGURES.slice(0, 3)
  .map(
    (f) =>
      `name: ${f.name} | wikipediaTitle: ${f.wikipediaTitle} | category: ${f.category}\n  hints: ${f.hints.join(" / ")}\n  acceptableAnswers: ${f.acceptableAnswers.join(", ")}`
  )
  .join("\n")}

Output ONLY the JSON. Be factually accurate; if unsure a person's Wikipedia page has a photo, pick someone more famous.`;

const SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    wikipediaTitle: { type: "string" },
    category: { type: "string" },
    hints: { type: "array", items: { type: "string" } },
    acceptableAnswers: { type: "array", items: { type: "string" } },
  },
  required: ["name", "wikipediaTitle", "category", "hints", "acceptableAnswers"],
  additionalProperties: false,
} as const;

async function callOnce(seed: string): Promise<Personality | null> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [
      { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: `Pick a fresh British figure — vary the field and era. Variation token: ${seed}.`,
      },
    ],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!validatePersonality(parsed).ok) return null;
  return normalisePersonality(parsed as Personality);
}

export function fallbackFigure(): Personality {
  return FALLBACK_FIGURES[Math.floor(Math.random() * FALLBACK_FIGURES.length)];
}

/** Try the model twice; null if it never returns a valid personality. */
export async function generatePersonality(
  seed: string
): Promise<Personality | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const p = await callOnce(seed);
      if (p) return p;
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        console.error(
          `Claude API error (${err.status}) on personality attempt ${attempt}:`,
          err.message
        );
      } else {
        console.error(`Personality attempt ${attempt} failed:`, err);
      }
    }
  }
  return null;
}
