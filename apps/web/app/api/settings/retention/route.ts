import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember, requireOrgAdmin } from "@/lib/clerk-auth";
import {
  listRetentionPolicies,
  upsertRetentionPolicy,
  deleteRetentionPolicy,
  RETENTION_DATA_TYPES,
} from "@/lib/queries-retention";
import { recordAudit } from "@/lib/audit";

const upsertSchema = z.object({
  projectId: z.string().uuid().nullable(),
  dataType: z.enum(RETENTION_DATA_TYPES as [string, ...string[]]),
  retentionDays: z.number().int().min(1).max(3650),
  enabled: z.boolean().default(true),
});

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireOrgMember();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId") ?? undefined;
    const policies = await listRetentionPolicies(organizationId, { projectId });
    return NextResponse.json({ policies });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await requireOrgAdmin();
    const raw = (await request.json()) as unknown;
    const parsed = upsertSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const policy = await upsertRetentionPolicy({
      organizationId: ctx.organizationId,
      projectId: parsed.data.projectId,
      dataType: parsed.data.dataType as (typeof RETENTION_DATA_TYPES)[number],
      retentionDays: parsed.data.retentionDays,
      enabled: parsed.data.enabled,
    });

    await recordAudit({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "retention.updated",
      targetType: "retention_policy",
      targetId: policy.id,
      targetLabel: `${policy.dataType} · ${policy.retentionDays}d`,
      metadata: {
        projectId: policy.projectId,
        enabled: policy.enabled,
      },
    });

    return NextResponse.json(policy);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await requireOrgAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const ok = await deleteRetentionPolicy(id);
    if (!ok) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
