import { eq, sql } from "drizzle-orm";
import { getDb } from "./index";
import { projects } from "./schema";
import { dsnKeys } from "./schema-enterprise";

export interface DsnLookupResult {
  projectId: string;
  dsnKeyId: string | null;
  environment: string | null;
  source: "legacy" | "dsn_keys";
}

/**
 * Resolve a DSN public key to its project.
 * Accepts both the legacy `projects.publicKey` (kept for backward compatibility) and
 * any per-environment key stored in the new `dsn_keys` table.
 */
export async function findProjectIdByPublicKey(publicKey: string): Promise<string | null> {
  const result = await resolveDsn(publicKey);
  return result?.projectId ?? null;
}

/**
 * Same as findProjectIdByPublicKey, but returns richer metadata used by ingest
 * to track per-DSN usage and respect revocations.
 */
export async function resolveDsn(publicKey: string): Promise<DsnLookupResult | null> {
  if (!publicKey) return null;

  const db = getDb();

  // Prefer the new dsn_keys table; fall back to projects.publicKey.
  const [dsnRow] = await db
    .select({
      id: dsnKeys.id,
      projectId: dsnKeys.projectId,
      environment: dsnKeys.environment,
      revokedAt: dsnKeys.revokedAt,
    })
    .from(dsnKeys)
    .where(eq(dsnKeys.publicKey, publicKey))
    .limit(1);

  if (dsnRow) {
    if (dsnRow.revokedAt) return null;
    // Update lastUsedAt asynchronously; don't block ingest.
    void db
      .update(dsnKeys)
      .set({ lastUsedAt: sql`now()` })
      .where(eq(dsnKeys.id, dsnRow.id))
      .catch(() => undefined);
    return {
      projectId: dsnRow.projectId,
      dsnKeyId: dsnRow.id,
      environment: dsnRow.environment,
      source: "dsn_keys",
    };
  }

  const [projectRow] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.publicKey, publicKey))
    .limit(1);

  if (projectRow) {
    return {
      projectId: projectRow.id,
      dsnKeyId: null,
      environment: null,
      source: "legacy",
    };
  }

  return null;
}

/**
 * Generate a new DSN public key (32 hex chars, no dashes).
 */
export function generatePublicKey(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
