// Server-only MongoDB implementation of ServedGroupsRepo, plus the selector that
// picks Mongo when MONGODB_URI is set and falls back to no-op otherwise. Every
// method degrades gracefully (getDb() can return null) so a store outage never
// breaks play — it just means no dedup for that request.

import "server-only";
import { getDb, SERVED_GROUPS_COLLECTION } from "./mongo";
import { noopServedGroups, type ServedGroupsRepo } from "./served-groups";

export function mongoServedGroups(): ServedGroupsRepo {
  return {
    async seen(signatures) {
      const db = await getDb();
      if (!db || signatures.length === 0) return new Set();
      const docs = await db
        .collection(SERVED_GROUPS_COLLECTION)
        .find({ sig: { $in: signatures } }, { projection: { sig: 1, _id: 0 } })
        .toArray();
      return new Set(docs.map((d) => d.sig as string));
    },
    async remember(groups) {
      const db = await getDb();
      if (!db || groups.length === 0) return;
      const col = db.collection(SERVED_GROUPS_COLLECTION);
      // Idempotent upsert on sig so a concurrent double-serve can't throw on the
      // unique index.
      await Promise.all(
        groups.map((gr) =>
          col.updateOne(
            { sig: gr.sig },
            {
              $setOnInsert: {
                sig: gr.sig,
                name: gr.name,
                members: gr.members,
                createdAt: new Date(),
              },
            },
            { upsert: true }
          )
        )
      );
    },
    async recentNames(limit) {
      const db = await getDb();
      if (!db) return [];
      const docs = await db
        .collection(SERVED_GROUPS_COLLECTION)
        .find({}, { projection: { name: 1, _id: 0 } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
      return docs.map((d) => d.name as string).filter(Boolean);
    },
  };
}

/** Mongo when configured, otherwise no-op (game still plays, just no dedup). */
export function getServedGroups(): ServedGroupsRepo {
  return process.env.MONGODB_URI ? mongoServedGroups() : noopServedGroups();
}
