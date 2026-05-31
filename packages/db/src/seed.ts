import { randomBytes } from "node:crypto";
import { createDb } from "./index";
import { projects } from "./schema";

async function seed(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const { db, client } = createDb(databaseUrl, 1);
  const publicKey = randomBytes(16).toString("hex");
  const organizationId = process.env.SEED_ORGANIZATION_ID ?? "legacy-org";

  const [project] = await db
    .insert(projects)
    .values({
      name: "Demo Project",
      publicKey,
      organizationId,
    })
    .returning();

  if (!project) {
    throw new Error("Failed to create seed project");
  }

  console.log("Seed complete:");
  console.log(`  Project ID: ${project.id}`);
  console.log(`  Organization ID: ${organizationId}`);
  console.log(`  Public Key: ${project.publicKey}`);
  console.log(`  DSN: https://${project.publicKey}@localhost:3001/v1/ingest`);

  await client.end();
}

seed().catch((err: unknown) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
