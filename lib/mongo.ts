// Server-only MongoDB connection, cached on globalThis so Next's dev hot-reload
// and serverless invocations reuse one client. Returns null (never throws) when
// MONGODB_URI is unset or the cluster is unreachable, so callers degrade to no-op.

import "server-only";
import { MongoClient, type Db } from "mongodb";

const DB_NAME = "apol_games";
const SERVED_GROUPS = "served_groups";
const SERVED_PEOPLE = "served_people";

const g = globalThis as unknown as { _connMongo?: Promise<MongoClient> };

export async function getDb(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  try {
    if (!g._connMongo) {
      g._connMongo = new MongoClient(uri).connect().then(async (client) => {
        const db = client.db(DB_NAME);
        // Permanent uniqueness keys; idempotent to create.
        await db.collection(SERVED_GROUPS).createIndex({ sig: 1 }, { unique: true });
        await db.collection(SERVED_PEOPLE).createIndex({ qid: 1 }, { unique: true });
        await db.collection(SERVED_PEOPLE).createIndex({ servedAt: 1 });
        return client;
      });
    }
    const client = await g._connMongo;
    return client.db(DB_NAME);
  } catch (err) {
    g._connMongo = undefined; // allow a later retry
    console.error("[mongo] connect failed:", err);
    return null;
  }
}

export const SERVED_GROUPS_COLLECTION = SERVED_GROUPS;
export const SERVED_PEOPLE_COLLECTION = SERVED_PEOPLE;
