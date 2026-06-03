// The "have we served this group before?" store, behind a swappable interface.
// Pure module (no server-only) so it can be unit-tested and so dedup logic in
// dedupe.ts can import its types without pulling in the Mongo driver.

export interface ServedGroup {
  sig: string; // groupSignature(group) — the never-repeat key
  name: string; // readable category name, for the prompt avoid-list
  members: string[];
}

export interface ServedGroupsRepo {
  /** Of the given signatures, which have already been served. */
  seen(signatures: string[]): Promise<Set<string>>;
  /** Permanently record these groups as served (idempotent by sig). */
  remember(groups: ServedGroup[]): Promise<void>;
  /** Most-recently-served category names, newest first, for prompt steering. */
  recentNames(limit: number): Promise<string[]>;
}

/** In-memory implementation — used by tests and as a single-process fallback. */
export function inMemoryServedGroups(): ServedGroupsRepo {
  const order: ServedGroup[] = [];
  const sigs = new Set<string>();
  return {
    async seen(signatures) {
      return new Set(signatures.filter((s) => sigs.has(s)));
    },
    async remember(groups) {
      for (const g of groups) {
        if (!sigs.has(g.sig)) {
          sigs.add(g.sig);
          order.push(g);
        }
      }
    },
    async recentNames(limit) {
      return order.slice(-limit).reverse().map((g) => g.name);
    },
  };
}

/** No-op implementation — when no store is configured, the game plays with no dedup. */
export function noopServedGroups(): ServedGroupsRepo {
  return {
    async seen() {
      return new Set();
    },
    async remember() {},
    async recentNames() {
      return [];
    },
  };
}
