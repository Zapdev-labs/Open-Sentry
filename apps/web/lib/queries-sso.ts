import { and, eq } from "drizzle-orm";
import { getDb, ssoConnections, type SsoConnection } from "@sentry-clone/db";

function db() {
  return getDb();
}

export async function listSsoConnections(organizationId: string): Promise<SsoConnection[]> {
  return db()
    .select()
    .from(ssoConnections)
    .where(eq(ssoConnections.organizationId, organizationId))
    .orderBy(ssoConnections.createdAt);
}

export async function getSsoConnection(id: string): Promise<SsoConnection | null> {
  const [row] = await db()
    .select()
    .from(ssoConnections)
    .where(eq(ssoConnections.id, id))
    .limit(1);
  return row ?? null;
}

export async function getEnabledSsoConnectionForEmail(
  email: string
): Promise<SsoConnection | null> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  const rows = await db()
    .select()
    .from(ssoConnections)
    .where(eq(ssoConnections.enabled, true));
  for (const conn of rows) {
    if (conn.emailDomains.some((d) => d.toLowerCase() === domain)) return conn;
  }
  return null;
}

export async function createSsoConnection(input: {
  organizationId: string;
  providerType: SsoConnection["providerType"];
  providerName: string;
  emailDomains: string[];
  metadata: Record<string, unknown>;
  enabled: boolean;
}): Promise<SsoConnection> {
  const [row] = await db()
    .insert(ssoConnections)
    .values({
      organizationId: input.organizationId,
      providerType: input.providerType,
      providerName: input.providerName,
      emailDomains: input.emailDomains,
      metadata: input.metadata,
      enabled: input.enabled,
    })
    .returning();
  if (!row) throw new Error("Failed to create SSO connection");
  return row;
}

export async function updateSsoConnection(
  id: string,
  patch: {
    providerName?: string;
    emailDomains?: string[];
    metadata?: Record<string, unknown>;
    enabled?: boolean;
  }
): Promise<SsoConnection | null> {
  const [updated] = await db()
    .update(ssoConnections)
    .set({
      ...(patch.providerName !== undefined ? { providerName: patch.providerName } : {}),
      ...(patch.emailDomains !== undefined ? { emailDomains: patch.emailDomains } : {}),
      ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      updatedAt: new Date(),
    })
    .where(eq(ssoConnections.id, id))
    .returning();
  return updated ?? null;
}

export async function disableSsoConnection(id: string): Promise<boolean> {
  const result = await db()
    .update(ssoConnections)
    .set({ enabled: false, updatedAt: new Date() })
    .where(and(eq(ssoConnections.id, id), eq(ssoConnections.enabled, true)))
    .returning({ id: ssoConnections.id });
  return result.length > 0;
}
