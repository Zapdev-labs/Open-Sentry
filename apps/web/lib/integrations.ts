import {
  projectIntegrations,
  issueExternalLinks,
  linearIntegrationConfigSchema,
  type LinearIntegrationConfigPublic,
} from "@sentry-clone/db";
import { eq, and } from "drizzle-orm";
import { validateLinearApiKey } from "@sentry-clone/integrations";
import { db } from "@/lib/queries";

export async function getLinearIntegration(
  projectId: string
): Promise<{ enabled: boolean; config: LinearIntegrationConfigPublic } | null> {
  const [row] = await db()
    .select()
    .from(projectIntegrations)
    .where(
      and(
        eq(projectIntegrations.projectId, projectId),
        eq(projectIntegrations.provider, "linear")
      )
    )
    .limit(1);

  if (!row) {
    return { enabled: false, config: { teamId: "", hasApiKey: false } };
  }

  const parsed = linearIntegrationConfigSchema.safeParse(row.config);
  const teamId = parsed.success ? parsed.data.teamId : "";

  return {
    enabled: row.enabled,
    config: {
      teamId,
      hasApiKey: parsed.success && parsed.data.apiKey.length > 0,
    },
  };
}

export async function upsertLinearIntegration(
  projectId: string,
  input: { enabled: boolean; teamId: string; apiKey?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const teamId = input.teamId.trim();
  if (!teamId) {
    return { ok: false, error: "Linear team ID is required" };
  }

  const [existing] = await db()
    .select()
    .from(projectIntegrations)
    .where(
      and(
        eq(projectIntegrations.projectId, projectId),
        eq(projectIntegrations.provider, "linear")
      )
    )
    .limit(1);

  const existingConfig = existing
    ? linearIntegrationConfigSchema.safeParse(existing.config)
    : null;
  const apiKey = input.apiKey?.trim() || existingConfig?.data?.apiKey;

  if (!apiKey) {
    return { ok: false, error: "Linear API key is required" };
  }

  if (input.apiKey?.trim()) {
    const valid = await validateLinearApiKey(apiKey);
    if (!valid) {
      return { ok: false, error: "Invalid Linear API key" };
    }
  }

  const config = { apiKey, teamId };
  const now = new Date();

  if (existing) {
    await db()
      .update(projectIntegrations)
      .set({ enabled: input.enabled, config, updatedAt: now })
      .where(eq(projectIntegrations.id, existing.id));
  } else {
    await db().insert(projectIntegrations).values({
      projectId,
      provider: "linear",
      enabled: input.enabled,
      config,
      updatedAt: now,
    });
  }

  return { ok: true };
}

export async function getIssueExternalLinks(issueId: string) {
  return db()
    .select()
    .from(issueExternalLinks)
    .where(eq(issueExternalLinks.issueId, issueId));
}
