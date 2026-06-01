import { and, desc, eq, inArray } from "drizzle-orm";
import {
  getDb,
  alertRules,
  alertChannels,
  alertRuleChannels,
  alertDeliveries,
  type AlertRule,
  type AlertChannel,
  type AlertRuleQuery,
  type AlertChannelConfig,
  type AlertDelivery,
} from "@sentry-clone/db";

export type AlertRuleWithChannels = AlertRule & {
  channelIds: string[];
};

export type AlertChannelWithRuleCount = AlertChannel & {
  ruleCount: number;
};

function db() {
  return getDb();
}

// --- Rules ------------------------------------------------------------------

export async function listAlertRules(
  organizationId: string,
  options: { projectId?: string } = {}
): Promise<AlertRuleWithChannels[]> {
  const conditions = [eq(alertRules.organizationId, organizationId)];
  if (options.projectId) {
    conditions.push(eq(alertRules.projectId, options.projectId));
  }

  const rules = await db()
    .select()
    .from(alertRules)
    .where(and(...conditions))
    .orderBy(desc(alertRules.createdAt));

  if (rules.length === 0) return [];
  const ruleIds = rules.map((r) => r.id);

  const linkRows = await db()
    .select()
    .from(alertRuleChannels)
    .where(inArray(alertRuleChannels.ruleId, ruleIds));
  const linkMap = new Map<string, string[]>();
  for (const link of linkRows) {
    const list = linkMap.get(link.ruleId) ?? [];
    list.push(link.channelId);
    linkMap.set(link.ruleId, list);
  }

  return rules.map((r) => ({
    ...r,
    channelIds: linkMap.get(r.id) ?? [],
  }));
}

export async function getAlertRule(
  ruleId: string
): Promise<AlertRuleWithChannels | null> {
  const [rule] = await db()
    .select()
    .from(alertRules)
    .where(eq(alertRules.id, ruleId))
    .limit(1);
  if (!rule) return null;

  const links = await db()
    .select()
    .from(alertRuleChannels)
    .where(eq(alertRuleChannels.ruleId, ruleId));

  return {
    ...rule,
    channelIds: links.map((l) => l.channelId),
  };
}

export async function createAlertRule(input: {
  organizationId: string;
  projectId: string | null;
  name: string;
  description?: string;
  ruleType: AlertRule["ruleType"];
  query: AlertRuleQuery;
  thresholdWindow: number;
  thresholdCount: number;
  environment?: string;
  enabled: boolean;
  cooldownMinutes: number;
  channelIds: string[];
  createdBy: string;
}): Promise<AlertRuleWithChannels> {
  const [row] = await db()
    .insert(alertRules)
    .values({
      organizationId: input.organizationId,
      projectId: input.projectId,
      name: input.name,
      description: input.description,
      ruleType: input.ruleType,
      query: input.query,
      thresholdWindow: input.thresholdWindow,
      thresholdCount: input.thresholdCount,
      environment: input.environment,
      enabled: input.enabled,
      cooldownMinutes: input.cooldownMinutes,
      createdBy: input.createdBy,
    })
    .returning();
  if (!row) throw new Error("Failed to create alert rule");

  if (input.channelIds.length > 0) {
    await db()
      .insert(alertRuleChannels)
      .values(
        input.channelIds.map((channelId) => ({
          ruleId: row.id,
          channelId,
        }))
      )
      .onConflictDoNothing();
  }

  return { ...row, channelIds: input.channelIds };
}

export async function updateAlertRule(
  ruleId: string,
  input: {
    name?: string;
    description?: string;
    ruleType?: AlertRule["ruleType"];
    query?: AlertRuleQuery;
    thresholdWindow?: number;
    thresholdCount?: number;
    environment?: string | null;
    enabled?: boolean;
    cooldownMinutes?: number;
    channelIds?: string[];
  }
): Promise<AlertRuleWithChannels | null> {
  const patch: Partial<typeof alertRules.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.ruleType !== undefined) patch.ruleType = input.ruleType;
  if (input.query !== undefined) patch.query = input.query;
  if (input.thresholdWindow !== undefined) patch.thresholdWindow = input.thresholdWindow;
  if (input.thresholdCount !== undefined) patch.thresholdCount = input.thresholdCount;
  if (input.environment !== undefined) {
    patch.environment = input.environment;
  }
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.cooldownMinutes !== undefined) patch.cooldownMinutes = input.cooldownMinutes;

  const [updated] = await db()
    .update(alertRules)
    .set(patch)
    .where(eq(alertRules.id, ruleId))
    .returning();
  if (!updated) return null;

  if (input.channelIds !== undefined) {
    await db()
      .delete(alertRuleChannels)
      .where(eq(alertRuleChannels.ruleId, ruleId));
    if (input.channelIds.length > 0) {
      await db()
        .insert(alertRuleChannels)
        .values(
          input.channelIds.map((channelId) => ({
            ruleId,
            channelId,
          }))
        )
        .onConflictDoNothing();
    }
  }

  return {
    ...updated,
    channelIds: input.channelIds ?? (await getAlertRule(ruleId))?.channelIds ?? [],
  };
}

export async function deleteAlertRule(ruleId: string): Promise<boolean> {
  const result = await db()
    .delete(alertRules)
    .where(eq(alertRules.id, ruleId))
    .returning({ id: alertRules.id });
  return result.length > 0;
}

export async function markRuleTriggered(ruleId: string): Promise<void> {
  await db()
    .update(alertRules)
    .set({ lastTriggeredAt: new Date() })
    .where(eq(alertRules.id, ruleId));
}

// --- Channels ---------------------------------------------------------------

export async function listAlertChannels(
  organizationId: string,
  options: { projectId?: string } = {}
): Promise<AlertChannelWithRuleCount[]> {
  const conditions = [eq(alertChannels.organizationId, organizationId)];
  if (options.projectId) {
    conditions.push(eq(alertChannels.projectId, options.projectId));
  }

  const channels = await db()
    .select()
    .from(alertChannels)
    .where(and(...conditions))
    .orderBy(desc(alertChannels.createdAt));

  if (channels.length === 0) return [];
  const channelIds = channels.map((c) => c.id);

  const linkRows = await db()
    .select()
    .from(alertRuleChannels)
    .where(inArray(alertRuleChannels.channelId, channelIds));
  const countMap = new Map<string, number>();
  for (const link of linkRows) {
    countMap.set(link.channelId, (countMap.get(link.channelId) ?? 0) + 1);
  }

  return channels.map((c) => ({
    ...c,
    ruleCount: countMap.get(c.id) ?? 0,
  }));
}

export async function getAlertChannel(
  channelId: string
): Promise<AlertChannelWithRuleCount | null> {
  const [channel] = await db()
    .select()
    .from(alertChannels)
    .where(eq(alertChannels.id, channelId))
    .limit(1);
  if (!channel) return null;

  const linkRows = await db()
    .select()
    .from(alertRuleChannels)
    .where(eq(alertRuleChannels.channelId, channelId));

  return {
    ...channel,
    ruleCount: linkRows.length,
  };
}

export async function listChannelsForRule(
  ruleId: string
): Promise<AlertChannel[]> {
  const linkRows = await db()
    .select()
    .from(alertRuleChannels)
    .where(eq(alertRuleChannels.ruleId, ruleId));
  if (linkRows.length === 0) return [];

  const channelIds = linkRows.map((l) => l.channelId);
  return db()
    .select()
    .from(alertChannels)
    .where(
      and(inArray(alertChannels.id, channelIds), eq(alertChannels.enabled, true))
    );
}

export async function createAlertChannel(input: {
  organizationId: string;
  projectId: string | null;
  name: string;
  channelType: AlertChannel["channelType"];
  config: AlertChannelConfig;
  enabled: boolean;
  createdBy: string;
}): Promise<AlertChannel> {
  const [row] = await db()
    .insert(alertChannels)
    .values({
      organizationId: input.organizationId,
      projectId: input.projectId,
      name: input.name,
      channelType: input.channelType,
      config: input.config,
      enabled: input.enabled,
      createdBy: input.createdBy,
    })
    .returning();
  if (!row) throw new Error("Failed to create alert channel");
  return row;
}

export async function updateAlertChannel(
  channelId: string,
  input: {
    name?: string;
    config?: AlertChannelConfig;
    enabled?: boolean;
  }
): Promise<AlertChannel | null> {
  const patch: Partial<typeof alertChannels.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.config !== undefined) patch.config = input.config;
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (Object.keys(patch).length === 0) {
    const [existing] = await db()
      .select()
      .from(alertChannels)
      .where(eq(alertChannels.id, channelId))
      .limit(1);
    return existing ?? null;
  }
  const [updated] = await db()
    .update(alertChannels)
    .set(patch)
    .where(eq(alertChannels.id, channelId))
    .returning();
  return updated ?? null;
}

export async function deleteAlertChannel(channelId: string): Promise<boolean> {
  const result = await db()
    .delete(alertChannels)
    .where(eq(alertChannels.id, channelId))
    .returning({ id: alertChannels.id });
  return result.length > 0;
}

// --- Deliveries -------------------------------------------------------------

export async function recordAlertDelivery(input: {
  ruleId: string;
  channelId: string;
  payload: Record<string, unknown>;
  status: AlertDelivery["status"];
  responseCode?: number;
  responseBody?: string;
  errorMessage?: string;
  attempt: number;
}): Promise<void> {
  await db().insert(alertDeliveries).values({
    ruleId: input.ruleId,
    channelId: input.channelId,
    payload: input.payload,
    status: input.status,
    responseCode: input.responseCode,
    responseBody: input.responseBody,
    errorMessage: input.errorMessage,
    attempt: input.attempt,
    sentAt: input.status === "delivered" || input.status === "failed" ? new Date() : null,
  });
}

export async function listAlertDeliveries(
  options: {
    organizationId: string;
    ruleId?: string;
    channelId?: string;
    limit?: number;
  }
): Promise<Array<AlertDelivery & { ruleName: string; channelName: string }>> {
  const limit = options.limit ?? 50;

  const conditions = [];
  if (options.ruleId) {
    conditions.push(eq(alertDeliveries.ruleId, options.ruleId));
  }
  if (options.channelId) {
    conditions.push(eq(alertDeliveries.channelId, options.channelId));
  }

  const rows = await db()
    .select({
      delivery: alertDeliveries,
      ruleName: alertRules.name,
      channelName: alertChannels.name,
    })
    .from(alertDeliveries)
    .innerJoin(alertRules, eq(alertDeliveries.ruleId, alertRules.id))
    .innerJoin(alertChannels, eq(alertDeliveries.channelId, alertChannels.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(alertDeliveries.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r.delivery,
    ruleName: r.ruleName,
    channelName: r.channelName,
  }));
}

// --- Rule evaluation helpers (used by the worker) --------------------------

export type RuleEvaluation =
  | { triggered: false }
  | { triggered: true; value: number; message: string };

export interface RuleContext {
  organizationId: string;
  projectId: string | null;
  query: AlertRuleQuery;
  thresholdWindow: number;
  thresholdCount: number;
  environment: string | null;
}

// Concrete evaluators live in the worker to keep this module a thin data layer.
export type RuleEvaluator = (ctx: RuleContext) => Promise<RuleEvaluation>;
