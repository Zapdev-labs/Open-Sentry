import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgAdmin, requireOrgMember } from "@/lib/permissions";
import { getAlertRule, updateAlertRule, deleteAlertRule } from "@/lib/queries-alerts";
import { recordAudit } from "@/lib/audit";

const RULE_TYPE = [
  "issue.count_threshold",
  "issue.new",
  "issue.regression",
  "issue.frequency_spike",
  "transaction.error_rate",
  "transaction.p95_latency",
  "uptime.down",
  "uptime.recovered",
] as const;

const querySchema = z
  .object({
    levels: z.array(z.enum(["fatal", "error", "warning", "info", "debug"])).optional(),
    environments: z.array(z.string()).optional(),
    tags: z.record(z.string(), z.string()).optional(),
    uptimeMonitorId: z.string().uuid().optional(),
    transactionName: z.string().optional(),
  })
  .optional();

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  ruleType: z.enum(RULE_TYPE).optional(),
  query: querySchema,
  thresholdWindow: z.number().int().min(1).max(10080).optional(),
  thresholdCount: z.number().int().min(1).max(100000).optional(),
  environment: z.string().max(100).nullable().optional(),
  enabled: z.boolean().optional(),
  cooldownMinutes: z.number().int().min(0).max(10080).optional(),
  channelIds: z.array(z.string().uuid()).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireOrgMember();
    const { id } = await params;
    const rule = await getAlertRule(id);
    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }
    return NextResponse.json(rule);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const ctx = await requireOrgAdmin();
    const { id } = await params;
    const existing = await getAlertRule(id);
    if (!existing) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }
    const raw = (await request.json()) as unknown;
    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await updateAlertRule(id, {
      name: parsed.data.name,
      description: parsed.data.description,
      ruleType: parsed.data.ruleType,
      query: parsed.data.query,
      thresholdWindow: parsed.data.thresholdWindow,
      thresholdCount: parsed.data.thresholdCount,
      environment: parsed.data.environment,
      enabled: parsed.data.enabled,
      cooldownMinutes: parsed.data.cooldownMinutes,
      channelIds: parsed.data.channelIds,
    });
    if (!updated) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    await recordAudit({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "alert_rule.updated",
      targetType: "alert_rule",
      targetId: id,
      targetLabel: updated.name,
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const ctx = await requireOrgAdmin();
    const { id } = await params;
    const existing = await getAlertRule(id);
    if (!existing) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }
    const ok = await deleteAlertRule(id);
    if (!ok) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }
    await recordAudit({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "alert_rule.deleted",
      targetType: "alert_rule",
      targetId: id,
      targetLabel: existing.name,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
