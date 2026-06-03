// Server-only MongoDB implementation of ServedPeopleRepo, plus the selector
// that picks Mongo when MONGODB_URI is set and falls back to no-op otherwise.
// Every method degrades gracefully (getDb() can return null) so a store outage
// never breaks play — it just means no global dedup for that request.

import "server-only";
import { getDb, SERVED_PEOPLE_COLLECTION } from "./mongo";
import { noopServedPeople, type ServedPeopleRepo } from "./served-people";

export function mongoServedPeople(): ServedPeopleRepo {
  return {
    async servedQids() {
      const db = await getDb();
      if (!db) return new Set();
      const qids = await db.collection(SERVED_PEOPLE_COLLECTION).distinct("qid");
      return new Set(qids as string[]);
    },
    async remember(p) {
      const db = await getDb();
      if (!db) return;
      await db.collection(SERVED_PEOPLE_COLLECTION).updateOne(
        { qid: p.qid },
        {
          $set: { name: p.name, title: p.title, servedAt: new Date() },
          $setOnInsert: { qid: p.qid },
        },
        { upsert: true }
      );
    },
    async oldestServedQid(excludeQids) {
      const db = await getDb();
      if (!db) return null;
      const doc = await db
        .collection(SERVED_PEOPLE_COLLECTION)
        .find({ qid: { $nin: excludeQids } }, { projection: { qid: 1, _id: 0 } })
        .sort({ servedAt: 1 })
        .limit(1)
        .next();
      return doc ? (doc.qid as string) : null;
    },
  };
}

/** Mongo when configured, otherwise no-op (game still plays, just no global dedup). */
export function getServedPeople(): ServedPeopleRepo {
  return process.env.MONGODB_URI ? mongoServedPeople() : noopServedPeople();
}
