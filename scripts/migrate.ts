import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { resolve } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const migrationsFolder = resolve(import.meta.dir, "../packages/db/migrations");

async function run() {
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);
  console.log("Running migrations from", migrationsFolder);
  await migrate(db, { migrationsFolder });
  await client.end();
  console.log("Migrations complete");
}

run().catch((error: unknown) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
