// Server-only: the model NO LONGER chooses who to show. The person is
// picked from the Wikidata-sourced deck (guaranteed real + has a photo);
// the model only writes graded hints for that already-verified person,
// grounded by the Wikipedia extract so the clues stay factual.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  validatePersonality,
  normalisePersonality,
  FALLBACK_FIGURES,
  type Personality,
} from "./personality";
import { wlog } from "./log";

const client = new Anthropic();
const MODEL = "claude-sonnet-4-6";

const SYSTEM = `You write clues for "Who's Who", a guess-the-person game. You are GIVEN one real British public figure (already verified — they exist and have a photo). Your only job is to write the clue set for THAT person. You do not choose the person.

Return JSON matching the schema:
- category: a short role label for them (e.g. "Prime Minister", "Footballer", "Novelist", "Computer scientist").
- hints: EXACTLY 5 hints, ordered broad → specific. Hint 1 is vague (field/era only); each later hint is more revealing; hint 5 is giveaway-level (e.g. their first name, or an unmistakable signature achievement). CRITICAL: NO hint may contain the person's surname or full name.
- acceptableAnswers: lower-case strings a player might reasonably type to be marked correct — the surname alone, the full name, and well-known variants/nicknames/regnal names.

Be factually accurate and base the hints on the provided context. If the context is thin, use only what you reliably know about this specific person; never invent facts or hedge with "possibly". Output ONLY the JSON.`;

const SCHEMA = {
  type: "object",
  properties: {
    category: { type: "string" },
    hints: { type: "array", items: { type: "string" } },
    acceptableAnswers: { type: "array", items: { type: "string" } },
  },
  required: ["category", "hints", "acceptableAnswers"],
  additionalProperties: false,
} as const;

async function callOnce(
  name: string,
  title: string,
  context: string
): Promise<Personality | null> {
  const ctx = context.trim()
    ? context.trim().slice(0, 1200)
    : "(no extra context — rely on your own knowledge of this specific person)";
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    temperature: 1,
    system: [
      { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: `Write the Who's Who clue set for: ${name}

Context (from Wikipedia):
${ctx}

Remember: 5 graded hints, none containing the surname or full name.`,
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
    wlog("gen.parse_error", { name, sample: text.slice(0, 80) });
    return null;
  }
  // Inject the verified identity, then validate as a full profile (this also
  // enforces "no hint leaks the surname" against the real name).
  const candidate = {
    ...(parsed as object),
    name,
    wikipediaTitle: title,
  };
  const check = validatePersonality(candidate);
  if (!check.ok) {
    wlog("gen.invalid", { name, reason: check.error ?? "unknown" });
    return null;
  }
  const p = normalisePersonality(candidate as Personality);
  wlog("gen.ok", { name: p.name });
  return p;
}

export function fallbackFigure(): Personality {
  return FALLBACK_FIGURES[Math.floor(Math.random() * FALLBACK_FIGURES.length)];
}

/** Write a clue profile for a given verified person. Two attempts. */
export async function writeProfile(
  name: string,
  title: string,
  context: string
): Promise<Personality | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const p = await callOnce(name, title, context);
      if (p) return p;
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        wlog("gen.api_error", { name, status: err.status, msg: err.message });
      } else {
        wlog("gen.error", { name, msg: String(err) });
      }
    }
  }
  return null;
}
