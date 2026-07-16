import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember, requireOrgAdmin } from "@/lib/permissions";
import { listAlertRules, createAlertRule } from "@/lib/queries-alerts";
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

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  projectId: z.string().uuid().nullable().optional(),
  ruleType: z.enum(RULE_TYPE),
  query: querySchema,
  thresholdWindow: z.number().int().min(1).max(10080),
  thresholdCount: z.number().int().min(1).max(100000),
  environment: z.string().max(100).nullable().optional(),
  enabled: z.boolean().default(true),
  cooldownMinutes: z.number().int().min(0).max(10080).default(30),
  channelIds: z.array(z.string().uuid()).default([]),
});

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireOrgMember();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId") ?? undefined;
    const rules = await listAlertRules(organizationId, { projectId });
    return NextResponse.json({ rules });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireOrgAdmin();
    const raw = (await request.json()) as unknown;
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const rule = await createAlertRule({
      organizationId: ctx.organizationId,
      projectId: parsed.data.projectId ?? null,
      name: parsed.data.name.trim(),
      description: parsed.data.description,
      ruleType: parsed.data.ruleType,
      query: parsed.data.query ?? {},
      thresholdWindow: parsed.data.thresholdWindow,
      thresholdCount: parsed.data.thresholdCount,
      environment: parsed.data.environment ?? undefined,
      enabled: parsed.data.enabled,
      cooldownMinutes: parsed.data.cooldownMinutes,
      channelIds: parsed.data.channelIds,
      createdBy: ctx.userId,
    });

    await recordAudit({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "alert_rule.created",
      targetType: "alert_rule",
      targetId: rule.id,
      targetLabel: rule.name,
      metadata: { ruleType: rule.ruleType },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
