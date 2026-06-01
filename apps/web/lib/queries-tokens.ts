import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  getDb,
  apiTokens,
  dsnKeys,
  generatePublicKey,
  type ApiToken,
  type DsnKey,
  type NewDsnKey,
} from "@sentry-clone/db";
import { hashToken, issueToken, verifyToken } from "./tokens";

export interface ListedApiToken {
  id: string;
  name: string;
  scope: ApiToken["scope"];
  projectId: string | null;
  lastFour: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  createdBy: string;
  revokedAt: Date | null;
}

export interface CreateApiTokenInput {
  organizationId: string;
  name: string;
  scope: "read" | "write" | "admin";
  projectId?: string | null;
  createdBy: string;
  expiresAt?: Date | null;
}

export interface CreateApiTokenResult {
  token: ListedApiToken;
  plaintext: string;
}

export async function listApiTokens(organizationId: string): Promise<ListedApiToken[]> {
  const rows = await getDb()
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.organizationId, organizationId))
    .orderBy(desc(apiTokens.createdAt));
  return rows;
}

export async function createApiToken(
  input: CreateApiTokenInput
): Promise<CreateApiTokenResult> {
  const issued = issueToken(input.projectId ? "project" : "org");
  const [row] = await getDb()
    .insert(apiTokens)
    .values({
      organizationId: input.organizationId,
      projectId: input.projectId ?? null,
      name: input.name,
      tokenHash: issued.hash,
      lastFour: issued.lastFour,
      scope: input.scope,
      createdBy: input.createdBy,
      expiresAt: input.expiresAt ?? null,
    })
    .returning();
  if (!row) throw new Error("Failed to create API token");
  return {
    plaintext: issued.plaintext,
    token: { ...row },
  };
}

export async function revokeApiToken(
  organizationId: string,
  tokenId: string
): Promise<boolean> {
  const result = await getDb()
    .update(apiTokens)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(apiTokens.organizationId, organizationId), eq(apiTokens.id, tokenId)))
    .returning({ id: apiTokens.id });
  return result.length > 0;
}

/**
 * Validate a token presented via Authorization: Bearer <token> header.
 * Returns the token row (without the hash) if valid, or null otherwise.
 */
export async function authenticateApiToken(
  plaintext: string
): Promise<Omit<ApiToken, "tokenHash"> | null> {
  if (!plaintext) return null;
  const hash = hashToken(plaintext);
  const [row] = await getDb()
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, hash))
    .limit(1);
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
  // Constant-time compare as defense in depth.
  if (!verifyToken(plaintext, row.tokenHash)) return null;
  // Fire-and-forget lastUsedAt bump.
  void getDb()
    .update(apiTokens)
    .set({ lastUsedAt: sql`now()` })
    .where(eq(apiTokens.id, row.id))
    .catch(() => undefined);
  const { tokenHash, ...rest } = row;
  return rest;
}

// --- DSN keys --------------------------------------------------------------

export interface ListedDsnKey {
  id: string;
  publicKey: string;
  environment: DsnKey["environment"];
  label: string | null;
  isPrimary: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface CreateDsnKeyInput {
  projectId: string;
  environment: "production" | "staging" | "development" | "test" | "custom";
  label?: string;
  createdBy: string;
  isPrimary?: boolean;
}

export interface CreateDsnKeyResult {
  key: ListedDsnKey;
  publicKey: string;
  dsn: string;
}

export async function listDsnKeys(projectId: string): Promise<ListedDsnKey[]> {
  return getDb()
    .select()
    .from(dsnKeys)
    .where(eq(dsnKeys.projectId, projectId))
    .orderBy(desc(dsnKeys.createdAt));
}

export async function createDsnKey(input: CreateDsnKeyInput): Promise<CreateDsnKeyResult> {
  const publicKey = generatePublicKey();
  const values: NewDsnKey = {
    projectId: input.projectId,
    publicKey,
    environment: input.environment,
    label: input.label ?? null,
    isPrimary: input.isPrimary ?? false,
    createdBy: input.createdBy,
  };
  const [row] = await getDb().insert(dsnKeys).values(values).returning();
  if (!row) throw new Error("Failed to create DSN key");
  const ingestUrl = process.env.NEXT_PUBLIC_INGEST_URL ?? "http://localhost:3001";
  const dsn = `${ingestUrl}/v1/ingest?key=${publicKey}`;
  return {
    key: row,
    publicKey,
    dsn,
  };
}

export async function revokeDsnKey(projectId: string, keyId: string): Promise<boolean> {
  const result = await getDb()
    .update(dsnKeys)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(dsnKeys.projectId, projectId), eq(dsnKeys.id, keyId)))
    .returning({ id: dsnKeys.id });
  return result.length > 0;
}

export async function countActiveDsnKeys(projectId: string): Promise<number> {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(dsnKeys)
    .where(
      and(
        eq(dsnKeys.projectId, projectId),
        isNull(dsnKeys.revokedAt)
      )
    );
  return row?.count ?? 0;
}
