// Server-only puzzle generation via the Claude API. Never import this from a
// client component — it reads ANTHROPIC_API_KEY and must stay on the server.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  validatePuzzle,
  normalisePuzzle,
  ANCHOR_PUZZLES,
  type Puzzle,
} from "./puzzle";

export type Mode = "daily" | "endless";

// Opus 4.7 for the once-a-day shared puzzle (quality matters most there);
// Sonnet 4.6 for endless practice (frequent, fast, cheap).
const MODEL: Record<Mode, string> = {
  daily: "claude-opus-4-7",
  endless: "claude-sonnet-4-6",
};

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

// Static rules + few-shot anchors. This whole block is frozen so it can be
// prompt-cached; the only per-request variation goes in the user message.
const SYSTEM = `You are a puzzle setter for "British Connections", a word puzzle in the exact format of the New York Times Connections game, but written through a British cultural lens.

RULES OF A GOOD PUZZLE:
- Exactly 4 groups of exactly 4 words = 16 words total, all unique (case-insensitive).
- Each group has a difficulty "level": 0 = yellow (easiest, straightforward category), 1 = green, 2 = blue, 3 = purple (hardest — usually wordplay: a shared prefix/suffix, hidden words, homophones, "___ X" or "X ___" patterns).
- The craft is DELIBERATE OVERLAP TRAPS: several words must plausibly fit 2+ groups so the obvious grouping is a trap. A puzzle with no red herrings is a bad puzzle.
- British lens: this is a normal Connections puzzle (categories, synonyms, pop culture, wordplay) — NOT "everything must be British". The rule is simply that wherever a reference would otherwise default to American, use the British equivalent: football/cricket/rugby/snooker/darts not NFL/baseball; British TV, music, presenters; British spelling (colour, -ise); British slang, food, money, school terms, place names. Plenty of culture-neutral wordplay groups are good too.
- Single words or very short phrases only (tiles are small). UPPERCASE all members.
- Be factually correct. Do not invent. If unsure about a fact (which channel a soap is on, who played a role), pick a safer category you are certain of.
- Vary categories — do not reuse the same theme every time.

Here are hand-authored reference puzzles that set the quality bar. Match this style and trap density:

${ANCHOR_PUZZLES.map(
  (p, i) =>
    `Example ${i + 1}:\n` +
    p
      .map(
        (g) =>
          `  L${g.level} ${g.name}: ${g.members.join(", ")}`
      )
      .join("\n")
).join("\n\n")}

Output ONLY the puzzle as JSON matching the provided schema: a "groups" array of 4 objects, each {level, name, members[4]}. No commentary.`;

const SCHEMA = {
  type: "object",
  properties: {
    groups: {
      type: "array",
      items: {
        type: "object",
        properties: {
          level: { type: "integer", enum: [0, 1, 2, 3] },
          name: { type: "string" },
          members: { type: "array", items: { type: "string" } },
        },
        required: ["level", "name", "members"],
        additionalProperties: false,
      },
    },
  },
  required: ["groups"],
  additionalProperties: false,
} as const;

function userPrompt(mode: Mode, seed: string): string {
  if (mode === "daily") {
    return `Generate the British Connections puzzle for ${seed}. Make it a balanced, polished daily puzzle with strong overlap traps across all four groups.`;
  }
  return `Generate a fresh British Connections puzzle. Make it distinct from common themes — vary the categories. Variation token: ${seed}.`;
}

/** Deterministic anchor fallback so a generation failure still returns a puzzle. */
export function fallbackPuzzle(mode: Mode, seed: string): Puzzle {
  if (mode === "daily") {
    // Stable per date: same seed → same anchor for everyone.
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return ANCHOR_PUZZLES[Math.abs(h) % ANCHOR_PUZZLES.length];
  }
  return ANCHOR_PUZZLES[Math.floor(Math.random() * ANCHOR_PUZZLES.length)];
}

async function callOnce(mode: Mode, seed: string): Promise<Puzzle | null> {
  const res = await client.messages.create({
    model: MODEL[mode],
    max_tokens: 4096,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: {
      // Opus 4.7 has no temperature; effort is the quality/cost lever.
      effort: mode === "daily" ? "high" : "low",
      format: { type: "json_schema", schema: SCHEMA },
    },
    messages: [{ role: "user", content: userPrompt(mode, seed) }],
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
  const groups = (parsed as { groups?: unknown })?.groups;
  const check = validatePuzzle(groups);
  if (!check.ok) return null;
  return normalisePuzzle(groups as Puzzle);
}

/**
 * Generate a puzzle. Tries the model twice (it occasionally returns a
 * structurally-invalid puzzle despite the schema — e.g. duplicate words or a
 * 3-member group), then falls back to a vetted anchor so the route never 500s.
 */
export async function generatePuzzle(
  mode: Mode,
  seed: string
): Promise<{ puzzle: Puzzle; source: "ai" | "fallback" }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const p = await callOnce(mode, seed);
      if (p) return { puzzle: p, source: "ai" };
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        console.error(`Claude API error (${err.status}) on attempt ${attempt}:`, err.message);
      } else {
        console.error(`Generation attempt ${attempt} failed:`, err);
      }
    }
  }
  return { puzzle: fallbackPuzzle(mode, seed), source: "fallback" };
}
