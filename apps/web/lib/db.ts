import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as authSchema from "@sentry-clone/db/auth-schema";

let sharedClient: ReturnType<typeof postgres> | null = null;

export function getAuthDb() {
  const url =
    process.env.DATABASE_URL ??
    // Next.js collects page data at build time without runtime secrets.
    (process.env.NEXT_PHASE === "phase-production-build"
      ? "postgresql://build:build@127.0.0.1:5432/build"
      : undefined);
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  if (!sharedClient) {
    sharedClient = postgres(url, { max: 10 });
  }
  return drizzle(sharedClient, { schema: authSchema });
}
