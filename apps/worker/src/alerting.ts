import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import {
  getDb,
  alertRules,
  alertChannels,
  issues,
  events,
  transactions,
  uptimeMonitors,
  projects,
  type AlertRule,
  type AlertChannel,
} from "@sentry-clone/db";
import { deliverToChannel, type AlertPayload } from "../../web/lib/alert-delivery";
import {
  listChannelsForRule,
  markRuleTriggered,
  recordAlertDelivery,
} from "../../web/lib/queries-alerts";

const TICK_MS = 60 * 1000; // every minute

interface ProjectScope {
  organizationId: string;
  projectId: string | null;
  projectIds: string[];
}

async function resolveProjectScope(rule: AlertRule): Promise<ProjectScope | null> {
  const db = getDb();
  if (rule.projectId) {
    return {
      organizationId: rule.organizationId,
      projectId: rule.projectId,
      projectIds: [rule.projectId],
    };
  }

  // Org-wide: pull every project under the org
  const orgProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.organizationId, rule.organizationId));
  const projectIds = orgProjects.map((p) => p.id);
  if (projectIds.length === 0) return null;
  return {
    organizationId: rule.organizationId,
    projectId: null,
    projectIds,
  };
}

function inCooldown(rule: AlertRule): boolean {
  if (!rule.lastTriggeredAt) return false;
  const elapsedMin = (Date.now() - new Date(rule.lastTriggeredAt).getTime()) / 60_000;
  return elapsedMin < rule.cooldownMinutes;
}

async function evaluateIssueCountThreshold(
  scope: ProjectScope,
  rule: AlertRule
): Promise<{ triggered: boolean; value: number; message: string }> {
  const db = getDb();
  const since = new Date(Date.now() - rule.thresholdWindow * 60_000);

  const [result] = await db
    .select({ count: count(events.id).mapWith(Number) })
    .from(events)
    .where(
      and(
        inArray(events.projectId, scope.projectIds),
        rule.environment
          ? eq(events.environment, rule.environment)
          : undefined,
        gte(events.timestamp, since)
      )
    );
  const value = result?.count ?? 0;
  if (value >= rule.thresholdCount) {
    return {
      triggered: true,
      value,
      message: `${value} events in the last ${rule.thresholdWindow} minutes (threshold: ${rule.thresholdCount}).`,
    };
  }
  return { triggered: false, value, message: "" };
}

async function evaluateNewIssues(
  scope: ProjectScope,
  rule: AlertRule
): Promise<{ triggered: boolean; value: number; message: string }> {
  const db = getDb();
  const since = new Date(Date.now() - rule.thresholdWindow * 60_000);

  const [result] = await db
    .select({ count: count(issues.id).mapWith(Number) })
    .from(issues)
    .where(
      and(
        inArray(issues.projectId, scope.projectIds),
        gte(issues.firstSeen, since)
      )
    );
  const value = result?.count ?? 0;
  if (value >= rule.thresholdCount) {
    return {
      triggered: true,
      value,
      message: `${value} new issues in the last ${rule.thresholdWindow} minutes.`,
    };
  }
  return { triggered: false, value, message: "" };
}

async function evaluateRegressions(
  scope: ProjectScope,
  rule: AlertRule
): Promise<{ triggered: boolean; value: number; message: string }> {
  const db = getDb();
  const since = new Date(Date.now() - rule.thresholdWindow * 60_000);

  const [result] = await db
    .select({ count: count(issues.id).mapWith(Number) })
    .from(issues)
    .where(
      and(
        inArray(issues.projectId, scope.projectIds),
        sql`${issues.regressionOf} IS NOT NULL`,
        gte(issues.lastSeen, since)
      )
    );
  const value = result?.count ?? 0;
  if (value >= rule.thresholdCount) {
    return {
      triggered: true,
      value,
      message: `${value} regressions detected in the last ${rule.thresholdWindow} minutes.`,
    };
  }
  return { triggered: false, value, message: "" };
}

async function evaluateTransactionErrorRate(
  scope: ProjectScope,
  rule: AlertRule
): Promise<{ triggered: boolean; value: number; message: string }> {
  const db = getDb();
  const since = new Date(Date.now() - rule.thresholdWindow * 60_000);

  const [result] = await db
    .select({
      total: count(transactions.id).mapWith(Number),
      errors: sql<number>`count(*) filter (where ${transactions.status} = 'error')::int`.mapWith(Number),
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.projectId, scope.projectIds),
        rule.environment
          ? eq(transactions.environment, rule.environment)
          : undefined,
        gte(transactions.timestamp, since)
      )
    );
  const total = result?.total ?? 0;
  const errors = result?.errors ?? 0;
  const rate = total > 0 ? (errors / total) * 100 : 0;
  // thresholdCount for this rule type is treated as a percentage (1-100)
  if (total >= 5 && rate >= rule.thresholdCount) {
    return {
      triggered: true,
      value: Math.round(rate * 10) / 10,
      message: `Transaction error rate is ${rate.toFixed(1)}% (${errors}/${total}) in the last ${rule.thresholdWindow} minutes (threshold: ${rule.thresholdCount}%).`,
    };
  }
  return { triggered: false, value: Math.round(rate * 10) / 10, message: "" };
}

async function evaluateTransactionP95(
  scope: ProjectScope,
  rule: AlertRule
): Promise<{ triggered: boolean; value: number; message: string }> {
  const db = getDb();
  const since = new Date(Date.now() - rule.thresholdWindow * 60_000);

  const [result] = await db
    .select({
      p95: sql<number>`percentile_cont(0.95) within group (order by ${transactions.durationMs})::int`.mapWith(Number),
      total: count(transactions.id).mapWith(Number),
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.projectId, scope.projectIds),
        rule.environment
          ? eq(transactions.environment, rule.environment)
          : undefined,
        gte(transactions.timestamp, since)
      )
    );
  const p95 = result?.p95 ?? 0;
  const total = result?.total ?? 0;
  if (total >= 5 && p95 >= rule.thresholdCount) {
    return {
      triggered: true,
      value: p95,
      message: `p95 transaction latency is ${p95}ms over the last ${rule.thresholdWindow} minutes (threshold: ${rule.thresholdCount}ms).`,
    };
  }
  return { triggered: false, value: p95, message: "" };
}

async function evaluateUptimeDown(
  scope: ProjectScope,
  rule: AlertRule
): Promise<{ triggered: boolean; value: number; message: string }> {
  const db = getDb();
  const monitorFilter = rule.query.uptimeMonitorId
    ? eq(uptimeMonitors.id, rule.query.uptimeMonitorId)
    : inArray(uptimeMonitors.projectId, scope.projectIds);

  const rows = await db
    .select({
      id: uptimeMonitors.id,
      name: uptimeMonitors.name,
      currentStatus: uptimeMonitors.currentStatus,
    })
    .from(uptimeMonitors)
    .where(and(monitorFilter, eq(uptimeMonitors.currentStatus, "down")));

  if (rows.length === 0) {
    return { triggered: false, value: 0, message: "" };
  }
  return {
    triggered: rows.length >= rule.thresholdCount,
    value: rows.length,
    message: `${rows.length} uptime monitor${rows.length === 1 ? "" : "s"} down: ${rows.map((r) => r.name).join(", ")}.`,
  };
}

async function evaluateUptimeRecovered(
  scope: ProjectScope,
  rule: AlertRule
): Promise<{ triggered: boolean; value: number; message: string }> {
  const db = getDb();
  const since = new Date(Date.now() - rule.thresholdWindow * 60_000);
  const monitorFilter = rule.query.uptimeMonitorId
    ? eq(uptimeMonitors.id, rule.query.uptimeMonitorId)
    : inArray(uptimeMonitors.projectId, scope.projectIds);

  const [result] = await db
    .select({ count: count(uptimeMonitors.id).mapWith(Number) })
    .from(uptimeMonitors)
    .where(
      and(
        monitorFilter,
        eq(uptimeMonitors.currentStatus, "up"),
        gte(uptimeMonitors.lastCheckedAt, since)
      )
    );
  const value = result?.count ?? 0;
  if (value >= rule.thresholdCount) {
    return {
      triggered: true,
      value,
      message: `${value} uptime monitor${value === 1 ? "" : "s"} recovered.`,
    };
  }
  return { triggered: false, value, message: "" };
}

async function evaluateRule(rule: AlertRule): Promise<{
  triggered: boolean;
  value: number;
  message: string;
}> {
  const scope = await resolveProjectScope(rule);
  if (!scope) return { triggered: false, value: 0, message: "" };

  switch (rule.ruleType) {
    case "issue.count_threshold":
      return evaluateIssueCountThreshold(scope, rule);
    case "issue.new":
      return evaluateNewIssues(scope, rule);
    case "issue.regression":
      return evaluateRegressions(scope, rule);
    case "issue.frequency_spike":
      // Same query as count_threshold but with a frequency interpretation; we
      // use the same evaluator to keep the implementation simple.
      return evaluateIssueCountThreshold(scope, rule);
    case "transaction.error_rate":
      return evaluateTransactionErrorRate(scope, rule);
    case "transaction.p95_latency":
      return evaluateTransactionP95(scope, rule);
    case "uptime.down":
      return evaluateUptimeDown(scope, rule);
    case "uptime.recovered":
      return evaluateUptimeRecovered(scope, rule);
  }
}

async function fireAlert(
  rule: AlertRule,
  channels: AlertChannel[],
  value: number,
  message: string
): Promise<void> {
  const payload: AlertPayload = {
    ruleId: rule.id,
    ruleName: rule.name,
    ruleType: rule.ruleType,
    value,
    threshold: rule.thresholdCount,
    windowMinutes: rule.thresholdWindow,
    environment: rule.environment,
    organizationId: rule.organizationId,
    triggeredAt: new Date().toISOString(),
    message,
  };

  for (const channel of channels) {
    const result = await deliverToChannel(channel, payload);
    await recordAlertDelivery({
      ruleId: rule.id,
      channelId: channel.id,
      payload: payload as unknown as Record<string, unknown>,
      status: result.ok ? "delivered" : "failed",
      responseCode: result.responseCode,
      responseBody: result.responseBody,
      errorMessage: result.ok ? undefined : result.errorMessage,
      attempt: 1,
    });
  }

  await markRuleTriggered(rule.id);
}

export async function runAlertingPass(): Promise<{
  evaluated: number;
  triggered: number;
}> {
  const db = getDb();
  const rules = await db
    .select()
    .from(alertRules)
    .where(eq(alertRules.enabled, true));

  let triggeredCount = 0;

  for (const rule of rules) {
    try {
      if (inCooldown(rule)) continue;
      const result = await evaluateRule(rule);
      if (!result.triggered) continue;
      const channels = await listChannelsForRule(rule.id);
      if (channels.length === 0) continue;
      await fireAlert(rule, channels, result.value, result.message);
      triggeredCount++;
    } catch (err) {
      console.error(`[alerting] rule ${rule.id} (${rule.name}) failed:`, err);
    }
  }

  return { evaluated: rules.length, triggered: triggeredCount };
}

export function startAlertingScheduler(): () => void {
  async function tick(): Promise<void> {
    const start = Date.now();
    try {
      const { evaluated, triggered } = await runAlertingPass();
      if (triggered > 0) {
        console.log(
          `[alerting] fired ${triggered}/${evaluated} rules in ${Date.now() - start}ms`
        );
      }
    } catch (err) {
      console.error("[alerting] pass failed:", err);
    }
  }

  void tick();
  const timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  console.log(`Alerting scheduler started (interval=${TICK_MS}ms)`);
  return () => clearInterval(timer);
}
