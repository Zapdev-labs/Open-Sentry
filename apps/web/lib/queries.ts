import { getDb, projects, issues, events, transactions, spans } from "@sentry-clone/db";
import { eq, desc, and, lt, sql, gte, count, inArray } from "drizzle-orm";

export function db() {
  return getDb();
}

export async function getProjects(organizationId: string) {
  return db()
    .select()
    .from(projects)
    .where(eq(projects.organizationId, organizationId))
    .orderBy(desc(projects.createdAt));
}

export async function getProject(id: string, organizationId?: string) {
  const conditions = organizationId
    ? and(eq(projects.id, id), eq(projects.organizationId, organizationId))
    : eq(projects.id, id);
  const [project] = await db().select().from(projects).where(conditions).limit(1);
  return project ?? null;
}

export async function createProject(name: string, organizationId: string) {
  const publicKey = crypto.randomUUID().replace(/-/g, "");
  const [project] = await db()
    .insert(projects)
    .values({ name, publicKey, organizationId })
    .returning();
  return project;
}

export async function getOrganizationStats(organizationId: string) {
  const projectRows = await db()
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.organizationId, organizationId));

  const projectIds = projectRows.map((p) => p.id);
  if (projectIds.length === 0) {
    return {
      projectCount: 0,
      openIssues: 0,
      totalIssues: 0,
      eventsToday: 0,
      transactionsToday: 0,
      errorRate: 0,
    };
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [issueStats] = await db()
    .select({
      totalIssues: count(issues.id).mapWith(Number),
      openIssues: sql<number>`count(*) filter (where ${issues.status} = 'open')::int`.mapWith(Number),
    })
    .from(issues)
    .where(inArray(issues.projectId, projectIds));

  const [eventStats] = await db()
    .select({
      eventsToday: count(events.id).mapWith(Number),
    })
    .from(events)
    .where(and(inArray(events.projectId, projectIds), gte(events.timestamp, dayAgo)));

  const [txStats] = await db()
    .select({
      transactionsToday: count(transactions.id).mapWith(Number),
      errorTransactions: sql<number>`count(*) filter (where ${transactions.status} = 'error')::int`.mapWith(Number),
    })
    .from(transactions)
    .where(and(inArray(transactions.projectId, projectIds), gte(transactions.timestamp, dayAgo)));

  const transactionsToday = txStats?.transactionsToday ?? 0;
  const errorTransactions = txStats?.errorTransactions ?? 0;

  return {
    projectCount: projectIds.length,
    openIssues: issueStats?.openIssues ?? 0,
    totalIssues: issueStats?.totalIssues ?? 0,
    eventsToday: eventStats?.eventsToday ?? 0,
    transactionsToday,
    errorRate:
      transactionsToday > 0
        ? Math.round((errorTransactions / transactionsToday) * 100)
        : 0,
  };
}

export async function getProjectSummaries(organizationId: string) {
  const projectList = await getProjects(organizationId);

  if (projectList.length === 0) return [];

  const summaries = await Promise.all(
    projectList.map(async (project) => {
      const [issueStats] = await db()
        .select({
          openIssues: sql<number>`count(*) filter (where ${issues.status} = 'open')::int`.mapWith(Number),
          totalEvents: sql<number>`coalesce(sum(${issues.eventCount}), 0)::int`.mapWith(Number),
        })
        .from(issues)
        .where(eq(issues.projectId, project.id));

      const [txCount] = await db()
        .select({ count: count(transactions.id).mapWith(Number) })
        .from(transactions)
        .where(eq(transactions.projectId, project.id));

      return {
        ...project,
        openIssues: issueStats?.openIssues ?? 0,
        totalEvents: issueStats?.totalEvents ?? 0,
        transactionCount: txCount?.count ?? 0,
      };
    })
  );

  return summaries;
}

export async function getRecentActivity(organizationId: string, limit = 8) {
  const projectRows = await db()
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.organizationId, organizationId));

  const projectIds = projectRows.map((p) => p.id);
  const projectNames = new Map(projectRows.map((p) => [p.id, p.name]));

  if (projectIds.length === 0) return [];

  const recentEvents = await db()
    .select({
      id: events.id,
      projectId: events.projectId,
      message: events.message,
      timestamp: events.timestamp,
      environment: events.environment,
    })
    .from(events)
    .where(inArray(events.projectId, projectIds))
    .orderBy(desc(events.timestamp))
    .limit(limit);

  return recentEvents.map((event) => ({
    ...event,
    projectName: projectNames.get(event.projectId) ?? "Unknown",
    type: "error" as const,
  }));
}

export async function getProjectOverview(projectId: string) {
  const [issueStats] = await db()
    .select({
      openIssues: sql<number>`count(*) filter (where ${issues.status} = 'open')::int`.mapWith(Number),
      resolvedIssues: sql<number>`count(*) filter (where ${issues.status} = 'resolved')::int`.mapWith(Number),
      ignoredIssues: sql<number>`count(*) filter (where ${issues.status} = 'ignored')::int`.mapWith(Number),
      totalEvents: sql<number>`coalesce(sum(${issues.eventCount}), 0)::int`.mapWith(Number),
    })
    .from(issues)
    .where(eq(issues.projectId, projectId));

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [recentEvents] = await db()
    .select({ count: count(events.id).mapWith(Number) })
    .from(events)
    .where(and(eq(events.projectId, projectId), gte(events.timestamp, dayAgo)));

  const txStats = await getTransactionStats(projectId);

  return {
    openIssues: issueStats?.openIssues ?? 0,
    resolvedIssues: issueStats?.resolvedIssues ?? 0,
    ignoredIssues: issueStats?.ignoredIssues ?? 0,
    totalEvents: issueStats?.totalEvents ?? 0,
    eventsToday: recentEvents?.count ?? 0,
    transactionStats: txStats,
  };
}

export async function getIssues(
  projectId: string,
  status?: string,
  level?: string
) {
  let conditions = eq(issues.projectId, projectId);

  if (status) {
    conditions = and(
      conditions,
      eq(issues.status, status as "open" | "resolved" | "ignored")
    )!;
  }

  if (level) {
    conditions = and(
      conditions,
      eq(issues.level, level as "fatal" | "error" | "warning" | "info" | "debug")
    )!;
  }

  return db()
    .select({
      id: issues.id,
      title: issues.title,
      status: issues.status,
      level: issues.level,
      eventCount: issues.eventCount,
      lastSeen: issues.lastSeen,
      firstSeen: issues.firstSeen,
    })
    .from(issues)
    .where(conditions)
    .orderBy(desc(issues.lastSeen))
    .limit(100);
}

export async function getIssue(issueId: string) {
  const [issue] = await db().select().from(issues).where(eq(issues.id, issueId)).limit(1);
  return issue ?? null;
}

export async function updateIssueStatus(
  issueId: string,
  status: "open" | "resolved" | "ignored"
) {
  const [updated] = await db()
    .update(issues)
    .set({ status })
    .where(eq(issues.id, issueId))
    .returning();
  return updated;
}

export async function getIssueEvents(issueId: string, cursor?: string, limit = 20) {
  const conditions = cursor
    ? and(eq(events.issueId, issueId), lt(events.timestamp, new Date(cursor)))
    : eq(events.issueId, issueId);

  return db()
    .select()
    .from(events)
    .where(conditions)
    .orderBy(desc(events.timestamp))
    .limit(limit);
}

export async function getTransactions(projectId: string, limit = 50) {
  return db()
    .select()
    .from(transactions)
    .where(eq(transactions.projectId, projectId))
    .orderBy(desc(transactions.timestamp))
    .limit(limit);
}

export async function getTransactionStats(projectId: string): Promise<{
  count: number;
  p50: number;
  p95: number;
  avg: number;
}> {
  const [stats] = await db()
    .select({
      count: sql<number>`count(*)::int`.mapWith(Number),
      p50: sql<number>`coalesce(percentile_cont(0.5) within group (order by ${transactions.durationMs}), 0)::int`.mapWith(Number),
      p95: sql<number>`coalesce(percentile_cont(0.95) within group (order by ${transactions.durationMs}), 0)::int`.mapWith(Number),
      avg: sql<number>`coalesce(avg(${transactions.durationMs}), 0)::int`.mapWith(Number),
    })
    .from(transactions)
    .where(eq(transactions.projectId, projectId));

  return stats ?? { count: 0, p50: 0, p95: 0, avg: 0 };
}

export async function getTransactionSpans(transactionId: string) {
  return db()
    .select()
    .from(spans)
    .where(eq(spans.transactionId, transactionId));
}

export function buildDsn(publicKey: string): string {
  const ingestUrl = process.env.NEXT_PUBLIC_INGEST_URL ?? "http://localhost:3001";
  const host = ingestUrl.replace(/^https?:\/\//, "");
  return `https://${publicKey}@${host}/v1/ingest`;
}
