import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import {
  getDb,
  retentionPolicies,
  projects,
  events,
  transactions,
  aiGenerations,
  uptimeChecks,
  uptimeMonitors,
  type RetentionPolicy,
} from "@sentry-clone/db";

export type RetentionDataType = RetentionPolicy["dataType"];

export const RETENTION_DATA_TYPES: RetentionDataType[] = [
  "events",
  "transactions",
  "spans",
  "ai_generations",
  "uptime_checks",
  "all",
];

export type RetentionPolicyWithProject = RetentionPolicy & {
  projectName: string | null;
};

function db() {
  return getDb();
}

export async function listRetentionPolicies(
  organizationId: string,
  options: { projectId?: string } = {}
): Promise<RetentionPolicyWithProject[]> {
  const baseConditions = [eq(retentionPolicies.organizationId, organizationId)];
  if (options.projectId) {
    baseConditions.push(eq(retentionPolicies.projectId, options.projectId));
  }

  const rows = await db()
    .select({
      policy: retentionPolicies,
      projectName: projects.name,
    })
    .from(retentionPolicies)
    .leftJoin(projects, eq(retentionPolicies.projectId, projects.id))
    .where(and(...baseConditions))
    .orderBy(retentionPolicies.projectId, retentionPolicies.dataType);

  return rows.map((r) => ({
    ...r.policy,
    projectName: r.projectName,
  }));
}

export async function getEffectiveRetentionDays(input: {
  organizationId: string;
  projectId: string;
  dataType: Exclude<RetentionDataType, "all">;
}): Promise<number | null> {
  // 1. Project-specific policy wins
  const [projectPolicy] = await db()
    .select()
    .from(retentionPolicies)
    .where(
      and(
        eq(retentionPolicies.organizationId, input.organizationId),
        eq(retentionPolicies.projectId, input.projectId),
        eq(retentionPolicies.dataType, input.dataType),
        eq(retentionPolicies.enabled, true)
      )
    )
    .limit(1);
  if (projectPolicy) return projectPolicy.retentionDays;

  // 2. Org default for that data type
  const [orgTypePolicy] = await db()
    .select()
    .from(retentionPolicies)
    .where(
      and(
        eq(retentionPolicies.organizationId, input.organizationId),
        isNull(retentionPolicies.projectId),
        eq(retentionPolicies.dataType, input.dataType),
        eq(retentionPolicies.enabled, true)
      )
    )
    .limit(1);
  if (orgTypePolicy) return orgTypePolicy.retentionDays;

  // 3. Org "all" default
  const [orgAllPolicy] = await db()
    .select()
    .from(retentionPolicies)
    .where(
      and(
        eq(retentionPolicies.organizationId, input.organizationId),
        isNull(retentionPolicies.projectId),
        eq(retentionPolicies.dataType, "all"),
        eq(retentionPolicies.enabled, true)
      )
    )
    .limit(1);
  if (orgAllPolicy) return orgAllPolicy.retentionDays;

  return null;
}

export async function upsertRetentionPolicy(input: {
  organizationId: string;
  projectId: string | null;
  dataType: RetentionDataType;
  retentionDays: number;
  enabled: boolean;
}): Promise<RetentionPolicy> {
  const conditions = input.projectId
    ? and(
        eq(retentionPolicies.organizationId, input.organizationId),
        eq(retentionPolicies.projectId, input.projectId),
        eq(retentionPolicies.dataType, input.dataType)
      )
    : and(
        eq(retentionPolicies.organizationId, input.organizationId),
        isNull(retentionPolicies.projectId),
        eq(retentionPolicies.dataType, input.dataType)
      );

  const [existing] = await db()
    .select()
    .from(retentionPolicies)
    .where(conditions)
    .limit(1);

  if (existing) {
    const [updated] = await db()
      .update(retentionPolicies)
      .set({
        retentionDays: input.retentionDays,
        enabled: input.enabled,
        updatedAt: new Date(),
      })
      .where(eq(retentionPolicies.id, existing.id))
      .returning();
    if (!updated) throw new Error("Failed to update retention policy");
    return updated;
  }

  const [row] = await db()
    .insert(retentionPolicies)
    .values({
      organizationId: input.organizationId,
      projectId: input.projectId,
      dataType: input.dataType,
      retentionDays: input.retentionDays,
      enabled: input.enabled,
    })
    .returning();
  if (!row) throw new Error("Failed to create retention policy");
  return row;
}

export async function deleteRetentionPolicy(policyId: string): Promise<boolean> {
  const result = await db()
    .delete(retentionPolicies)
    .where(eq(retentionPolicies.id, policyId))
    .returning({ id: retentionPolicies.id });
  return result.length > 0;
}

// Used by the worker to count rows that would be deleted at a given cutoff.
// Returns a map keyed by data type for "all" or single-type usage.
export async function countOldData(input: {
  organizationId: string;
  projectId: string | null;
  cutoff: Date;
}): Promise<{ events: number; transactions: number; aiGenerations: number; uptimeChecks: number }> {
  const projectIds = await resolveProjectIds(input.organizationId, input.projectId);
  if (projectIds.length === 0) {
    return { events: 0, transactions: 0, aiGenerations: 0, uptimeChecks: 0 };
  }

  const [e] = await db()
    .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
    .from(events)
    .where(and(inArray(events.projectId, projectIds), lt(events.timestamp, input.cutoff)));

  const [t] = await db()
    .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
    .from(transactions)
    .where(
      and(inArray(transactions.projectId, projectIds), lt(transactions.timestamp, input.cutoff))
    );

  const [a] = await db()
    .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
    .from(aiGenerations)
    .where(
      and(inArray(aiGenerations.projectId, projectIds), lt(aiGenerations.timestamp, input.cutoff))
    );

  // uptimeChecks are scoped by monitor; resolve monitors for these projects
  const [u] = await db()
    .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
    .from(uptimeChecks)
    .innerJoin(uptimeMonitors, eq(uptimeChecks.monitorId, uptimeMonitors.id))
    .where(
      and(
        inArray(uptimeMonitors.projectId, projectIds),
        lt(uptimeChecks.checkedAt, input.cutoff)
      )
    );

  return {
    events: e?.count ?? 0,
    transactions: t?.count ?? 0,
    aiGenerations: a?.count ?? 0,
    uptimeChecks: u?.count ?? 0,
  };
}

export async function resolveProjectIds(
  organizationId: string,
  projectId: string | null
): Promise<string[]> {
  if (projectId) return [projectId];
  const rows = await db()
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.organizationId, organizationId));
  return rows.map((r) => r.id);
}
