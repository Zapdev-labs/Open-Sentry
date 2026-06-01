import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { getDb, scimTokens, type ScimToken } from "@sentry-clone/db";

function db() {
  return getDb();
}

export type ListedScimToken = Omit<ScimToken, "tokenHash"> & { plaintext?: string };

export async function listScimTokens(organizationId: string): Promise<ListedScimToken[]> {
  const rows = await db()
    .select({
      id: scimTokens.id,
      organizationId: scimTokens.organizationId,
      label: scimTokens.label,
      lastFour: scimTokens.lastFour,
      status: scimTokens.status,
      createdBy: scimTokens.createdBy,
      lastUsedAt: scimTokens.lastUsedAt,
      revokedAt: scimTokens.revokedAt,
      createdAt: scimTokens.createdAt,
    })
    .from(scimTokens)
    .where(eq(scimTokens.organizationId, organizationId))
    .orderBy(desc(scimTokens.createdAt));

  return rows.map((r) => ({ ...r, tokenHash: "" })) as ListedScimToken[];
}

export async function findActiveScimTokenByHash(
  tokenHash: string
): Promise<ScimToken | null> {
  const [row] = await db()
    .select()
    .from(scimTokens)
    .where(
      and(
        eq(scimTokens.tokenHash, tokenHash),
        eq(scimTokens.status, "active"),
        isNull(scimTokens.revokedAt)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function createScimToken(input: {
  organizationId: string;
  label: string;
  tokenHash: string;
  lastFour: string;
  createdBy: string;
}): Promise<ScimToken> {
  const [row] = await db()
    .insert(scimTokens)
    .values({
      organizationId: input.organizationId,
      label: input.label,
      tokenHash: input.tokenHash,
      lastFour: input.lastFour,
      createdBy: input.createdBy,
    })
    .returning();
  if (!row) throw new Error("Failed to create SCIM token");
  return row;
}

export async function touchScimTokenLastUsed(id: string): Promise<void> {
  await db()
    .update(scimTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(scimTokens.id, id));
}

export async function revokeScimToken(id: string, organizationId: string): Promise<boolean> {
  const result = await db()
    .update(scimTokens)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(
      and(
        eq(scimTokens.id, id),
        eq(scimTokens.organizationId, organizationId),
        eq(scimTokens.status, "active")
      )
    )
    .returning({ id: scimTokens.id });
  return result.length > 0;
}

// Used by SCIM protocol endpoints to count active tokens for an org.
export async function countActiveScimTokens(organizationId: string): Promise<number> {
  const rows = await db()
    .select({ id: scimTokens.id })
    .from(scimTokens)
    .where(
      and(
        eq(scimTokens.organizationId, organizationId),
        eq(scimTokens.status, "active"),
        isNull(scimTokens.revokedAt),
        gt(scimTokens.createdAt, new Date(0))
      )
    );
  return rows.length;
}
