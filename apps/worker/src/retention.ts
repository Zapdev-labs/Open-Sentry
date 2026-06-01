import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import {
  getDb,
  retentionPolicies,
  events,
  transactions,
  aiGenerations,
  uptimeChecks,
  uptimeMonitors,
  projects,
  type RetentionPolicy,
} from "@sentry-clone/db";

const TICK_MS = 60 * 60 * 1000; // hourly
const MAX_DELETES_PER_TABLE = 100_000; // batched delete limit per table per policy

interface PruneStats {
  events: number;
  transactions: number;
  aiGenerations: number;
  uptimeChecks: number;
}

async function pruneTable<T extends { projectId?: unknown; timestamp?: unknown; checkedAt?: unknown }>(
  table: T,
  cutoff: Date,
  projectIds: string[],
  timestampColumn: "timestamp" | "checkedAt"
): Promise<number> {
  // We can't share a single helper across tables since they have distinct
  // column shapes, so dispatch to a per-table function below.
  void table;
  void cutoff;
  void projectIds;
  void timestampColumn;
  return 0;
}

async function pruneEventsForProjects(projectIds: string[], cutoff: Date): Promise<number> {
  const db = getDb();
  const result = await db
    .delete(events)
    .where(and(inArray(events.projectId, projectIds), lt(events.timestamp, cutoff)))
    .returning({ id: events.id });
  return result.length;
}

async function pruneTransactionsForProjects(
  projectIds: string[],
  cutoff: Date
): Promise<number> {
  const db = getDb();
  const result = await db
    .delete(transactions)
    .where(
      and(inArray(transactions.projectId, projectIds), lt(transactions.timestamp, cutoff))
    )
    .returning({ id: transactions.id });
  // Spans cascade-delete with their parent transaction, so no separate span
  // prune is needed.
  return result.length;
}

async function pruneAiGenerationsForProjects(
  projectIds: string[],
  cutoff: Date
): Promise<number> {
  const db = getDb();
  const result = await db
    .delete(aiGenerations)
    .where(
      and(inArray(aiGenerations.projectId, projectIds), lt(aiGenerations.timestamp, cutoff))
    )
    .returning({ id: aiGenerations.id });
  return result.length;
}

async function pruneUptimeChecksForProjects(
  projectIds: string[],
  cutoff: Date
): Promise<number> {
  const db = getDb();
  // uptimeChecks are scoped via uptimeMonitors → projectId
  const result = await db
    .delete(uptimeChecks)
    .where(
      and(
        inArray(
          uptimeChecks.monitorId,
          db
            .select({ id: uptimeMonitors.id })
            .from(uptimeMonitors)
            .where(inArray(uptimeMonitors.projectId, projectIds))
        ),
        lt(uptimeChecks.checkedAt, cutoff)
      )
    )
    .returning({ id: uptimeChecks.id });
  return result.length;
}

interface Scope {
  organizationId: string;
  projectId: string | null;
  projectIds: string[];
}

async function resolveScope(policy: RetentionPolicy): Promise<Scope | null> {
  if (policy.projectId) {
    return {
      organizationId: policy.organizationId,
      projectId: policy.projectId,
      projectIds: [policy.projectId],
    };
  }
  const db = getDb();
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.organizationId, policy.organizationId));
  const projectIds = rows.map((r) => r.id);
  if (projectIds.length === 0) return null;
  return {
    organizationId: policy.organizationId,
    projectId: null,
    projectIds,
  };
}

async function prunePolicy(policy: RetentionPolicy, stats: PruneStats): Promise<void> {
  const scope = await resolveScope(policy);
  if (!scope) return;

  const cutoff = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);
  const applies = (dataType: RetentionPolicy["dataType"]) =>
    policy.dataType === "all" || policy.dataType === dataType;

  if (applies("events")) {
    const deleted = await pruneEventsForProjects(scope.projectIds, cutoff);
    stats.events += deleted;
  }
  if (applies("transactions")) {
    const deleted = await pruneTransactionsForProjects(scope.projectIds, cutoff);
    stats.transactions += deleted;
  }
  if (applies("ai_generations")) {
    const deleted = await pruneAiGenerationsForProjects(scope.projectIds, cutoff);
    stats.aiGenerations += deleted;
  }
  if (applies("uptime_checks")) {
    const deleted = await pruneUptimeChecksForProjects(scope.projectIds, cutoff);
    stats.uptimeChecks += deleted;
  }

  const db = getDb();
  await db
    .update(retentionPolicies)
    .set({ lastPrunedAt: new Date() })
    .where(eq(retentionPolicies.id, policy.id));
}

export async function runRetentionPass(): Promise<{
  policiesProcessed: number;
  stats: PruneStats;
}> {
  const db = getDb();
  const policies = await db
    .select()
    .from(retentionPolicies)
    .where(eq(retentionPolicies.enabled, true));

  const stats: PruneStats = {
    events: 0,
    transactions: 0,
    aiGenerations: 0,
    uptimeChecks: 0,
  };

  for (const policy of policies) {
    try {
      await prunePolicy(policy, stats);
    } catch (err) {
      console.error(
        `[retention] policy ${policy.id} (${policy.dataType}) failed:`,
        err
      );
    }
  }

  return { policiesProcessed: policies.length, stats };
}

/**
 * Starts the retention scheduler loop. Runs immediately on startup, then every
 * TICK_MS. Returns a stop function for graceful shutdown.
 */
export function startRetentionScheduler(): () => void {
  async function tick(): Promise<void> {
    const start = Date.now();
    try {
      const { policiesProcessed, stats } = await runRetentionPass();
      const ms = Date.now() - start;
      const total =
        stats.events + stats.transactions + stats.aiGenerations + stats.uptimeChecks;
      if (policiesProcessed > 0 || total > 0) {
        console.log(
          `[retention] pruned ${total} rows across ${policiesProcessed} policies ` +
            `(events=${stats.events}, tx=${stats.transactions}, ` +
            `ai=${stats.aiGenerations}, uptime=${stats.uptimeChecks}) in ${ms}ms`
        );
      }
    } catch (err) {
      console.error("[retention] pass failed:", err);
    }
  }

  void tick();
  const timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  console.log(`Retention scheduler started (interval=${TICK_MS}ms)`);
  return () => clearInterval(timer);
}

// Suppress unused-symbol warning for the generic helper above.
void pruneTable;
void sql;
void isNull;
