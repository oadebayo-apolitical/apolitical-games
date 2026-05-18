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
import { wlog } from "./log";

const client = new Anthropic();
const MODEL = "claude-sonnet-4-6";

// NOTE: deliberately no example *people* here. Naming famous figures in the
// system prompt primes the model and causes mode-collapse (observed: one name
// returned 44% of the time). The schema is described structurally instead;
// concrete steering (field to use, names to avoid) goes in the user message.
const SYSTEM = `You run "Who's Who", a guess-the-British-public-figure game. Each turn you pick ONE real British public figure for the player to identify from a photo.

Return JSON matching the schema:
- name: the person's canonical full name.
- wikipediaTitle: the EXACT English Wikipedia article title for this person (a real article that has a photograph). Use the real title (e.g. "Elizabeth II", not "Queen Elizabeth II").
- category: a short role label (e.g. "Prime Minister", "Footballer", "Novelist").
- hints: EXACTLY 5 hints, ordered broad → specific. Hint 1 is vague (field only); each later hint is more revealing; hint 5 is giveaway-level (e.g. their first name). CRITICAL: no hint may contain the person's surname or full name.
- acceptableAnswers: lower-case ways a player might type the answer (surname alone, full name, well-known variants/nicknames).

DIVERSITY IS CRITICAL. This runs many times. Do NOT default to the handful of "most famous British people" (Churchill, Attenborough, the Queen, Bowie, Beckham, Adele, Vivienne Westwood, Emmeline Pankhurst, etc.). Each turn, pick someone genuinely different — a recognisable figure the British public would know, but reach beyond the obvious dozen. Span eras (Victorian to present) and the full range of fields. A well-known but less-predictable choice is better than a top-10 name.

Output ONLY the JSON. Be factually accurate; the Wikipedia article must exist and have a photo.`;

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

async function callOnce(
  category: string,
  avoid: string[]
): Promise<Personality | null> {
  const avoidList =
    avoid.length > 0 ? avoid.join("; ") : "(nothing yet — pick freely)";
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    // Sonnet 4.6 still honours temperature; max it for sampling spread.
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
        content: `This round, the person's primary field should be: ${category}.

Pick someone clearly recognisable to the British public in that field, but NOT one of the most over-used names — surprise me with a fresh, distinct choice across eras.

Do NOT pick any of these recently-used people: ${avoidList}.`,
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
    wlog("gen.parse_error", { sample: text.slice(0, 80) });
    return null;
  }
  const check = validatePersonality(parsed);
  if (!check.ok) {
    wlog("gen.invalid", {
      reason: check.error ?? "unknown",
      name: (parsed as { name?: string })?.name ?? "?",
    });
    return null;
  }
  const p = normalisePersonality(parsed as Personality);
  wlog("gen.ok", { name: p.name, title: p.wikipediaTitle });
  return p;
}

export function fallbackFigure(): Personality {
  return FALLBACK_FIGURES[Math.floor(Math.random() * FALLBACK_FIGURES.length)];
}

/** Try the model twice; null if it never returns a valid personality. */
export async function generatePersonality(
  category: string,
  avoid: string[]
): Promise<Personality | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const p = await callOnce(category, avoid);
      if (p) return p;
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        wlog("gen.api_error", { status: err.status, msg: err.message, attempt });
      } else {
        wlog("gen.error", { msg: String(err), attempt });
      }
    }
  }
  return null;
}
