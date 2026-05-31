import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as authSchema from "@sentry-clone/db/auth-schema";

let sharedClient: ReturnType<typeof postgres> | null = null;

export function getAuthDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  if (!sharedClient) {
    sharedClient = postgres(url, { max: 10 });
  }
  return drizzle(sharedClient, { schema: authSchema });
}
