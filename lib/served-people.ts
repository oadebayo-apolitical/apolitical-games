// The "have we shown this person before?" store for Who's Who, behind a
// swappable interface. Pure module (no server-only) so it's unit-testable.
// Keyed by Wikidata QID — the strongest identity signal per person.

export interface ServedPerson {
  qid: string;
  name: string;
  title: string;
}

export interface ServedPeopleRepo {
  /** All QIDs served so far (the exclusion set for selection). */
  servedQids(): Promise<Set<string>>;
  /** Record a person as served now (idempotent by qid; refreshes recency). */
  remember(p: ServedPerson): Promise<void>;
  /** The least-recently-served QID, excluding the given ones — for recycling
   *  once the deck is exhausted. Null if none are eligible. */
  oldestServedQid(excludeQids: string[]): Promise<string | null>;
}

/** In-memory implementation — used by tests and as a single-process fallback. */
export function inMemoryServedPeople(): ServedPeopleRepo {
  const seq = new Map<string, number>(); // qid -> serve order (higher = newer)
  let counter = 0;
  return {
    async servedQids() {
      return new Set(seq.keys());
    },
    async remember(p) {
      seq.set(p.qid, ++counter);
    },
    async oldestServedQid(excludeQids) {
      const exclude = new Set(excludeQids);
      let best: string | null = null;
      let bestSeq = Infinity;
      for (const [qid, s] of seq) {
        if (!exclude.has(qid) && s < bestSeq) {
          best = qid;
          bestSeq = s;
        }
      }
      return best;
    },
  };
}

/** No-op implementation — when no store is configured, there's no global dedup. */
export function noopServedPeople(): ServedPeopleRepo {
  return {
    async servedQids() {
      return new Set();
    },
    async remember() {},
    async oldestServedQid() {
      return null;
    },
  };
}
