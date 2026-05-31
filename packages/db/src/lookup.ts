import { eq } from "drizzle-orm";
import { getDb } from "./index";
import { projects } from "./schema";

export async function findProjectIdByPublicKey(publicKey: string): Promise<string | null> {
  const db = getDb();
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.publicKey, publicKey))
    .limit(1);
  return project?.id ?? null;
}
