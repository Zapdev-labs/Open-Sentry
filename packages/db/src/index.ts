import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";

const fullSchema = { ...schema, ...authSchema };

export type Database = ReturnType<typeof createDb>["db"];

let sharedClient: ReturnType<typeof postgres> | null = null;

export function createDb(connectionString: string, max = 10) {
  const client = postgres(connectionString, { max });
  const db = drizzle(client, { schema: fullSchema });
  return { db, client };
}

export function getDb(connectionString?: string): Database {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  if (!sharedClient) {
    sharedClient = postgres(url, { max: 10 });
  }
  return drizzle(sharedClient, { schema: fullSchema });
}

export { schema, authSchema, fullSchema };
export * from "./schema";
export * from "./grouping";
export * from "./ingest-types";
export * from "./lookup";
