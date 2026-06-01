import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@sentry-clone/db";

let sharedClient: ReturnType<typeof postgres> | null = null;

export function getDb(connectionString?: string) {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  if (!sharedClient) {
    sharedClient = postgres(url, { max: 10 });
  }
  return drizzle(sharedClient, { schema });
}
