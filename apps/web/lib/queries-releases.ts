import { getDb, releases, releaseIssueFirstSeen, issues, projects, type Release } from "@sentry-clone/db";
import { eq, desc, and, sql, inArray, lt, isNotNull, isNull, or } from "drizzle-orm";

export type ReleaseWithCounts = Release & {
  newIssueCount: number;
  totalEventCount: number;
};

export type ReleaseIssue = {
  id: string;
  fingerprint: string;
  title: string;
  level: string;
  status: string;
  eventCount: number;
  lastSeen: Date;
  firstSeenInThisRelease: boolean;
};

function db() {
  return getDb();
}

export async function listReleases(
  projectId: string,
  options: { limit?: number; status?: "open" | "shipped" | "archived" } = {}
): Promise<ReleaseWithCounts[]> {
  const limit = options.limit ?? 50;

  const conditions = [eq(releases.projectId, projectId)];
  if (options.status) {
    conditions.push(eq(releases.status, options.status));
  }

  const rows = await db()
    .select()
    .from(releases)
    .where(and(...conditions))
    .orderBy(desc(releases.createdAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const releaseIds = rows.map((r) => r.id);

  // Count of issues first-seen in each release
  const firstSeenCounts = await db()
    .select({
      releaseId: releaseIssueFirstSeen.releaseId,
      count: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(releaseIssueFirstSeen)
    .where(inArray(releaseIssueFirstSeen.releaseId, releaseIds))
    .groupBy(releaseIssueFirstSeen.releaseId);

  // Total event count for issues associated with each release (rough proxy)
  const eventCounts = await db()
    .select({
      projectId: issues.projectId,
      total: sql<number>`coalesce(sum(${issues.eventCount}), 0)::int`.mapWith(Number),
    })
    .from(issues)
    .where(eq(issues.projectId, projectId))
    .groupBy(issues.projectId);
  const totalEventCount = eventCounts[0]?.total ?? 0;

  const firstSeenMap = new Map(firstSeenCounts.map((c) => [c.releaseId, c.count]));

  return rows.map((row) => ({
    ...row,
    newIssueCount: firstSeenMap.get(row.id) ?? 0,
    totalEventCount,
  }));
}

export async function listOrgReleases(
  organizationId: string,
  options: { limit?: number } = {}
): Promise<Array<ReleaseWithCounts & { projectName: string; projectId: string }>> {
  const limit = options.limit ?? 50;

  const rows = await db()
    .select({
      release: releases,
      projectName: projects.name,
      projectId: projects.id,
    })
    .from(releases)
    .innerJoin(projects, eq(releases.projectId, projects.id))
    .where(eq(projects.organizationId, organizationId))
    .orderBy(desc(releases.createdAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const releaseIds = rows.map((r) => r.release.id);
  const firstSeenCounts = await db()
    .select({
      releaseId: releaseIssueFirstSeen.releaseId,
      count: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(releaseIssueFirstSeen)
    .where(inArray(releaseIssueFirstSeen.releaseId, releaseIds))
    .groupBy(releaseIssueFirstSeen.releaseId);
  const firstSeenMap = new Map(firstSeenCounts.map((c) => [c.releaseId, c.count]));

  return rows.map((r) => ({
    ...r.release,
    projectName: r.projectName,
    projectId: r.projectId,
    newIssueCount: firstSeenMap.get(r.release.id) ?? 0,
    totalEventCount: 0,
  }));
}

export async function getRelease(
  projectId: string,
  version: string
): Promise<(Release & { projectName: string; newIssueCount: number }) | null> {
  const [row] = await db()
    .select({
      release: releases,
      projectName: projects.name,
    })
    .from(releases)
    .innerJoin(projects, eq(releases.projectId, projects.id))
    .where(and(eq(releases.projectId, projectId), eq(releases.version, version)))
    .limit(1);

  if (!row) return null;

  const [count] = await db()
    .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
    .from(releaseIssueFirstSeen)
    .where(eq(releaseIssueFirstSeen.releaseId, row.release.id));

  return {
    ...row.release,
    projectName: row.projectName,
    newIssueCount: count?.count ?? 0,
  };
}

export async function createRelease(input: {
  projectId: string;
  version: string;
  ref?: string;
  environment?: string;
  url?: string;
  dateReleased?: Date;
  commits?: Array<{ id: string; message: string; author?: string }>;
  metadata?: Record<string, unknown>;
  createdBy: string;
}): Promise<Release> {
  const [row] = await db()
    .insert(releases)
    .values({
      projectId: input.projectId,
      version: input.version,
      ref: input.ref ?? null,
      environment: input.environment ?? null,
      url: input.url ?? null,
      dateReleased: input.dateReleased ?? null,
      commits: input.commits ?? [],
      metadata: input.metadata ?? {},
      createdBy: input.createdBy,
    })
    .returning();
  if (!row) {
    throw new Error("Failed to create release");
  }
  return row;
}

export async function deleteRelease(projectId: string, version: string): Promise<boolean> {
  const result = await db()
    .delete(releases)
    .where(and(eq(releases.projectId, projectId), eq(releases.version, version)))
    .returning({ id: releases.id });
  return result.length > 0;
}

export async function listIssuesForRelease(
  projectId: string,
  version: string,
  options: { limit?: number } = {}
): Promise<ReleaseIssue[]> {
  const limit = options.limit ?? 100;

  const [release] = await db()
    .select()
    .from(releases)
    .where(and(eq(releases.projectId, projectId), eq(releases.version, version)))
    .limit(1);

  if (!release) return [];

  // Issues that are flagged as first-seen in this release
  const firstSeenRows = await db()
    .select({
      issueId: releaseIssueFirstSeen.issueId,
      firstSeenAt: releaseIssueFirstSeen.firstSeenAt,
    })
    .from(releaseIssueFirstSeen)
    .where(eq(releaseIssueFirstSeen.releaseId, release.id));
  const firstSeenMap = new Map(firstSeenRows.map((r) => [r.issueId, r.firstSeenAt]));

  // Issues for this project
  const issueRows = await db()
    .select({
      id: issues.id,
      fingerprint: issues.fingerprint,
      title: issues.title,
      level: issues.level,
      status: issues.status,
      eventCount: issues.eventCount,
      lastSeen: issues.lastSeen,
      firstSeen: issues.firstSeen,
      firstRelease: issues.firstRelease,
      lastRelease: issues.lastRelease,
      regressionOf: issues.regressionOf,
    })
    .from(issues)
    .where(eq(issues.projectId, projectId))
    .orderBy(desc(issues.lastSeen))
    .limit(limit * 2); // over-fetch then filter

  // Filter to issues that are first-seen in this release OR have their firstRelease == this version
  const filtered = issueRows
    .filter((issue) => {
      if (firstSeenMap.has(issue.id)) return true;
      if (issue.firstRelease === version) return true;
      return false;
    })
    .slice(0, limit);

  return filtered.map((issue) => ({
    id: issue.id,
    fingerprint: issue.fingerprint,
    title: issue.title,
    level: issue.level,
    status: issue.status,
    eventCount: issue.eventCount,
    lastSeen: issue.lastSeen,
    firstSeenInThisRelease: firstSeenMap.has(issue.id),
  }));
}

// Used by the worker to record that an issue was first seen in a given release
export async function recordIssueFirstSeen(input: {
  projectId: string;
  releaseId: string;
  issueId: string;
}): Promise<void> {
  await db()
    .insert(releaseIssueFirstSeen)
    .values({
      projectId: input.projectId,
      releaseId: input.releaseId,
      issueId: input.issueId,
    })
    .onConflictDoNothing();
}

// Look up a release by its version within a project (used by the worker to wire
// up `transactions.release` and `issues.firstRelease` / `issues.lastRelease`).
export async function findReleaseByVersion(
  projectId: string,
  version: string
): Promise<Release | null> {
  const [row] = await db()
    .select()
    .from(releases)
    .where(and(eq(releases.projectId, projectId), eq(releases.version, version)))
    .limit(1);
  return row ?? null;
}

// Used by the worker to detect regressions. Returns the prior resolved version
// (issues.resolvedAt) for the same fingerprint in the same project, if any.
export async function findRegressionCandidate(input: {
  projectId: string;
  fingerprint: string;
}): Promise<{ id: string; resolvedAt: Date; resolvedBy: string | null } | null> {
  const [row] = await db()
    .select({
      id: issues.id,
      resolvedAt: issues.resolvedAt,
      resolvedBy: issues.resolvedBy,
    })
    .from(issues)
    .where(
      and(
        eq(issues.projectId, input.projectId),
        eq(issues.fingerprint, input.fingerprint),
        isNotNull(issues.resolvedAt)
      )
    )
    .orderBy(desc(issues.resolvedAt))
    .limit(1);
  if (!row || !row.resolvedAt) return null;
  return {
    id: row.id,
    resolvedAt: row.resolvedAt,
    resolvedBy: row.resolvedBy,
  };
}

export async function markIssueRegression(input: {
  issueId: string;
  regressionOf: string;
}): Promise<void> {
  await db()
    .update(issues)
    .set({
      regressionOf: input.regressionOf,
      status: "open",
      resolvedAt: null,
      resolvedBy: null,
      lastSeen: new Date(),
    })
    .where(eq(issues.id, input.issueId));
}
