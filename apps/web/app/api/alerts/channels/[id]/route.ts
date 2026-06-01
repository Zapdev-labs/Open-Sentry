import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgAdmin, requireOrgMember } from "@/lib/permissions";
import { getAlertChannel, updateAlertChannel, deleteAlertChannel } from "@/lib/queries-alerts";
import { recordAudit } from "@/lib/audit";

const CHANNEL_TYPE = [
  "slack",
  "webhook",
  "email",
  "pagerduty",
  "discord",
  "msteams",
] as const;

const slackConfig = z.object({ kind: z.literal("slack"), webhookUrl: z.string().url() });
const discordConfig = z.object({ kind: z.literal("discord"), webhookUrl: z.string().url() });
const teamsConfig = z.object({ kind: z.literal("msteams"), webhookUrl: z.string().url() });
const webhookConfig = z.object({
  kind: z.literal("webhook"),
  url: z.string().url(),
  secret: z.string().optional(),
});
const pagerdutyConfig = z.object({
  kind: z.literal("pagerduty"),
  integrationKey: z.string().min(1),
});
const emailConfig = z.object({
  kind: z.literal("email"),
  recipients: z.array(z.string().email()).min(1),
});

const configSchema = z.discriminatedUnion("kind", [
  slackConfig,
  discordConfig,
  teamsConfig,
  webhookConfig,
  pagerdutyConfig,
  emailConfig,
]);

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  channelType: z.enum(CHANNEL_TYPE).optional(),
  config: configSchema.optional(),
  enabled: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireOrgMember();
    const { id } = await params;
    const channel = await getAlertChannel(id);
    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    return NextResponse.json(channel);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const ctx = await requireOrgAdmin();
    const { id } = await params;
    const existing = await getAlertChannel(id);
    if (!existing) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    const raw = (await request.json()) as unknown;
    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await updateAlertChannel(id, {
      name: parsed.data.name,
      config: parsed.data.config,
      enabled: parsed.data.enabled,
    });
    if (!updated) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    await recordAudit({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "alert_channel.updated",
      targetType: "alert_channel",
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
    const existing = await getAlertChannel(id);
    if (!existing) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    const ok = await deleteAlertChannel(id);
    if (!ok) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    await recordAudit({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "alert_channel.deleted",
      targetType: "alert_channel",
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
