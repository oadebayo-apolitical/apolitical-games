// Server-only MongoDB connection, cached on globalThis so Next's dev hot-reload
// and serverless invocations reuse one client. Returns null (never throws) when
// MONGODB_URI is unset or the cluster is unreachable, so callers degrade to no-op.

import "server-only";
import { MongoClient, type Db } from "mongodb";

const DB_NAME = "apol_games";
const COLLECTION = "served_groups";

const g = globalThis as unknown as { _connMongo?: Promise<MongoClient> };

export async function getDb(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  try {
    if (!g._connMongo) {
      g._connMongo = new MongoClient(uri).connect().then(async (client) => {
        // Permanent uniqueness key; idempotent to create.
        await client
          .db(DB_NAME)
          .collection(COLLECTION)
          .createIndex({ sig: 1 }, { unique: true });
        return client;
      });
    }
    const client = await g._connMongo;
    return client.db(DB_NAME);
  } catch (err) {
    g._connMongo = undefined; // allow a later retry
    console.error("[connections] mongo.connect failed:", err);
    return null;
  }
}

export const SERVED_GROUPS_COLLECTION = COLLECTION;
