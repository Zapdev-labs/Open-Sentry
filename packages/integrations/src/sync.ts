import { and, eq, inArray } from "drizzle-orm";
import {
  type Database,
  linearIntegrationConfigSchema,
  projectIntegrations,
  issueExternalLinks,
} from "@sentry-clone/db";
import { createLinearIssue } from "./linear";

export interface NewIssueForIntegration {
  issueId: string;
  projectId: string;
  title: string;
  message: string;
  level: string;
  environment?: string;
  release?: string;
}

function appBaseUrl(): string {
  return (
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function buildIssueUrl(projectId: string, issueId: string): string {
  return `${appBaseUrl()}/projects/${projectId}/issues/${issueId}`;
}

function buildLinearDescription(issue: NewIssueForIntegration): string {
  const lines = [
    `**Error monitoring issue**`,
    ``,
    issue.message,
    ``,
    `- **Level:** ${issue.level}`,
  ];

  if (issue.environment) lines.push(`- **Environment:** ${issue.environment}`);
  if (issue.release) lines.push(`- **Release:** ${issue.release}`);

  lines.push(`- **Dashboard:** ${buildIssueUrl(issue.projectId, issue.issueId)}`);

  return lines.join("\n");
}

function linearIssueTitle(issue: NewIssueForIntegration): string {
  const prefix = issue.level === "fatal" ? "Fatal" : issue.level === "warning" ? "Warning" : "Error";
  const title = issue.title.length > 200 ? `${issue.title.slice(0, 197)}...` : issue.title;
  return `[${prefix}] ${title}`;
}

export async function syncNewIssuesToIntegrations(
  db: Database,
  items: NewIssueForIntegration[]
): Promise<void> {
  if (items.length === 0) return;

  const projectIds = [...new Set(items.map((i) => i.projectId))];
  const integrations = await db
    .select()
    .from(projectIntegrations)
    .where(
      and(
        inArray(projectIntegrations.projectId, projectIds),
        eq(projectIntegrations.provider, "linear"),
        eq(projectIntegrations.enabled, true)
      )
    );

  const linearByProject = new Map(
    integrations.map((row) => [row.projectId, row] as const)
  );

  for (const issue of items) {
    const integration = linearByProject.get(issue.projectId);
    if (!integration) continue;

    const parsed = linearIntegrationConfigSchema.safeParse(integration.config);
    if (!parsed.success) continue;

    const existing = await db
      .select({ id: issueExternalLinks.id })
      .from(issueExternalLinks)
      .where(
        and(
          eq(issueExternalLinks.issueId, issue.issueId),
          eq(issueExternalLinks.provider, "linear")
        )
      )
      .limit(1);

    if (existing.length > 0) continue;

    try {
      const linearIssue = await createLinearIssue(parsed.data.apiKey, {
        teamId: parsed.data.teamId,
        title: linearIssueTitle(issue),
        description: buildLinearDescription(issue),
      });

      if (!linearIssue) continue;

      await db
        .insert(issueExternalLinks)
        .values({
          issueId: issue.issueId,
          provider: "linear",
          externalId: linearIssue.id,
          externalUrl: linearIssue.url,
        })
        .onConflictDoNothing();
    } catch (error) {
      console.error("[integrations] Linear sync failed:", {
        issueId: issue.issueId,
        projectId: issue.projectId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
