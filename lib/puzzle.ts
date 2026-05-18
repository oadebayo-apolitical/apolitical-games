// Puzzle types, structural validation, and the hand-authored anchor pool.
// `level` is difficulty: 0=yellow (easiest) .. 3=purple (hardest, wordplay).

export interface Group {
  level: 0 | 1 | 2 | 3;
  name: string;
  members: [string, string, string, string];
}

// A puzzle is always exactly four groups, one per level.
export type Puzzle = [Group, Group, Group, Group];

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

const LEVELS = [0, 1, 2, 3];

/**
 * Structurally validate an unknown value as a Puzzle:
 * 4 groups, levels exactly {0,1,2,3}, 4 members each, 16 unique words,
 * non-empty category names.
 */
export function validatePuzzle(value: unknown): ValidationResult {
  if (!Array.isArray(value) || value.length !== 4) {
    return { ok: false, error: "puzzle must be an array of 4 groups" };
  }
  const groups = value as Group[];
  const levels = groups.map((g) => g?.level).sort();
  if (JSON.stringify(levels) !== JSON.stringify(LEVELS)) {
    return { ok: false, error: "levels must be exactly 0,1,2,3 (one each)" };
  }
  const words: string[] = [];
  for (const g of groups) {
    if (typeof g.name !== "string" || g.name.trim() === "") {
      return { ok: false, error: "every group needs a non-empty name" };
    }
    if (!Array.isArray(g.members) || g.members.length !== 4) {
      return { ok: false, error: `group "${g.name}" must have 4 members` };
    }
    for (const m of g.members) {
      if (typeof m !== "string" || m.trim() === "") {
        return { ok: false, error: `group "${g.name}" has an empty member` };
      }
      words.push(m.trim().toUpperCase());
    }
  }
  if (new Set(words).size !== 16) {
    return { ok: false, error: "all 16 words must be unique (case-insensitive)" };
  }
  return { ok: true };
}

/** Normalise a validated-ish value into a clean Puzzle (trim, uppercase). */
export function normalisePuzzle(value: Puzzle): Puzzle {
  return value.map((g) => ({
    level: g.level,
    name: g.name.trim(),
    members: g.members.map((m) => m.trim().toUpperCase()) as Group["members"],
  })) as Puzzle;
}

// Hand-authored anchor pool: few-shot examples for the generator AND the
// offline fallback if generation fails. British lens, deliberate overlap traps.
export const ANCHOR_PUZZLES: Puzzle[] = [
  [
    { level: 0, name: "Chocolate bars", members: ["TWIRL", "FLAKE", "WISPA", "CRUNCHIE"] },
    { level: 1, name: "Birds", members: ["ROBIN", "SWIFT", "SWALLOW", "WREN"] },
    { level: 2, name: "Snooker terms", members: ["BREAK", "POT", "SCREW", "KISS"] },
    { level: 3, name: "Slang for money", members: ["QUID", "DOSH", "WONGA", "BRASS"] },
  ],
  [
    { level: 0, name: "Football positions", members: ["KEEPER", "STRIKER", "SWEEPER", "WINGER"] },
    { level: 1, name: "Names for a bread roll", members: ["BAP", "COB", "BARM", "STOTTIE"] },
    { level: 2, name: "___ City football clubs", members: ["LEEDS", "HULL", "NORWICH", "STOKE"] },
    { level: 3, name: "___ + POOL", members: ["LIVER", "BLACK", "WHIRL", "CAR"] },
  ],
  [
    { level: 0, name: "Old British money", members: ["BOB", "TANNER", "GROAT", "FLORIN"] },
    { level: 1, name: "Doctor Who actors", members: ["BAKER", "TENNANT", "SMITH", "CAPALDI"] },
    { level: 2, name: "London Underground lines", members: ["VICTORIA", "CENTRAL", "JUBILEE", "DISTRICT"] },
    { level: 3, name: "UNDER ___", members: ["GROUND", "STAND", "DOG", "TAKER"] },
  ],
  [
    { level: 0, name: "British sitcoms", members: ["BLACKADDER", "MIRANDA", "EXTRAS", "SPACED"] },
    { level: 1, name: "Full English fry-up", members: ["SAUSAGE", "BEANS", "TOAST", "RASHER"] },
    { level: 2, name: "Cricket terms", members: ["OVER", "MAIDEN", "DUCK", "SLIP"] },
    { level: 3, name: "___ + POT", members: ["JACK", "CRACK", "TEA", "HOT"] },
  ],
  [
    { level: 0, name: "Knackered (tired)", members: ["KNACKERED", "SHATTERED", "WHACKED", "BUSHED"] },
    { level: 1, name: "Traditional sweets", members: ["HUMBUG", "GOBSTOPPER", "SHERBET", "ROCK"] },
    { level: 2, name: "British rivers", members: ["SEVERN", "THAMES", "TRENT", "OUSE"] },
    { level: 3, name: "___ + SIDE", members: ["MERSEY", "TYNE", "COUNTRY", "SEA"] },
  ],
  [
    { level: 0, name: "Garden birds", members: ["MAGPIE", "STARLING", "SPARROW", "FINCH"] },
    { level: 1, name: "Royal houses", members: ["TUDOR", "STUART", "WINDSOR", "YORK"] },
    { level: 2, name: "Knots", members: ["REEF", "GRANNY", "BOW", "HITCH"] },
    { level: 3, name: "NEW ___ (UK places)", members: ["CASTLE", "PORT", "QUAY", "BURY"] },
  ],
  [
    { level: 0, name: "Premier League clubs", members: ["ARSENAL", "EVERTON", "CHELSEA", "FULHAM"] },
    { level: 1, name: "Tennis terms", members: ["ACE", "LET", "LOVE", "FAULT"] },
    { level: 2, name: "Slang for amounts of money", members: ["PONY", "MONKEY", "GRAND", "TON"] },
    { level: 3, name: "Hidden body part", members: ["SHINDIG", "EARTH", "HIPPY", "ARMADA"] },
  ],
  [
    { level: 0, name: "Found in a pub", members: ["PINT", "DARTS", "QUIZ", "JUKEBOX"] },
    { level: 1, name: "Snooker ball colours", members: ["PINK", "BLUE", "GREEN", "BLACK"] },
    { level: 2, name: "UK Prime Ministers", members: ["BROWN", "MAJOR", "MAY", "BLAIR"] },
    { level: 3, name: "BLACK ___", members: ["POOL", "BIRD", "SMITH", "BERRY"] },
  ],
];
