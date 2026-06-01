import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgAdmin, requireOrgMember } from "@/lib/permissions";
import { listAlertChannels, createAlertChannel } from "@/lib/queries-alerts";
import { recordAudit } from "@/lib/audit";

const CHANNEL_TYPE = [
  "slack",
  "webhook",
  "email",
  "pagerduty",
  "discord",
  "msteams",
] as const;

const slackConfig = z.object({
  kind: z.literal("slack"),
  webhookUrl: z.string().url().max(500),
});
const discordConfig = z.object({
  kind: z.literal("discord"),
  webhookUrl: z.string().url().max(500),
});
const teamsConfig = z.object({
  kind: z.literal("msteams"),
  webhookUrl: z.string().url().max(500),
});
const webhookConfig = z.object({
  kind: z.literal("webhook"),
  url: z.string().url().max(500),
  secret: z.string().max(200).optional(),
});
const pagerdutyConfig = z.object({
  kind: z.literal("pagerduty"),
  integrationKey: z.string().min(1).max(200),
});
const emailConfig = z.object({
  kind: z.literal("email"),
  recipients: z.array(z.string().email()).min(1).max(50),
});

const configSchema = z.discriminatedUnion("kind", [
  slackConfig,
  discordConfig,
  teamsConfig,
  webhookConfig,
  pagerdutyConfig,
  emailConfig,
]);

const createSchema = z.object({
  name: z.string().min(1).max(120),
  projectId: z.string().uuid().nullable().optional(),
  channelType: z.enum(CHANNEL_TYPE),
  config: configSchema,
  enabled: z.boolean().default(true),
});

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireOrgMember();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId") ?? undefined;
    const channels = await listAlertChannels(organizationId, { projectId });
    return NextResponse.json({ channels });
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

    const channel = await createAlertChannel({
      organizationId: ctx.organizationId,
      projectId: parsed.data.projectId ?? null,
      name: parsed.data.name.trim(),
      channelType: parsed.data.channelType,
      config: parsed.data.config,
      enabled: parsed.data.enabled,
      createdBy: ctx.userId,
    });

    await recordAudit({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "alert_channel.created",
      targetType: "alert_channel",
      targetId: channel.id,
      targetLabel: channel.name,
      metadata: { channelType: channel.channelType },
    });

    return NextResponse.json(channel, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
