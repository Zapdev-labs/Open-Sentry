import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb, ssoConnections } from "@sentry-clone/db";
import { requireOrgAdmin } from "@/lib/permissions";
import {
  getSsoConnection,
  updateSsoConnection,
  disableSsoConnection,
} from "@/lib/queries-sso";
import { recordAudit } from "@/lib/audit";

const patchSchema = z.object({
  providerName: z.string().min(1).max(120).optional(),
  emailDomains: z.array(z.string().min(1).max(120)).min(1).max(20).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireOrgAdmin();
    const { id } = await params;
    const raw = (await request.json()) as unknown;
    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const existing = await getSsoConnection(id);
    if (!existing || existing.organizationId !== ctx.organizationId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const patch: Parameters<typeof updateSsoConnection>[1] = {};
    if (parsed.data.providerName !== undefined) {
      patch.providerName = parsed.data.providerName.trim();
    }
    if (parsed.data.emailDomains !== undefined) {
      patch.emailDomains = parsed.data.emailDomains.map((d) =>
        d.trim().toLowerCase().replace(/^@/, "")
      );
    }
    if (parsed.data.metadata !== undefined) patch.metadata = parsed.data.metadata;
    if (parsed.data.enabled !== undefined) patch.enabled = parsed.data.enabled;

    const updated = await updateSsoConnection(id, patch);
    if (!updated) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
    await recordAudit({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "sso.configured",
      targetType: "sso_connection",
      targetId: updated.id,
      targetLabel: updated.providerName,
      metadata: { changed: Object.keys(patch) },
    });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireOrgAdmin();
    const { id } = await params;
    const existing = await getSsoConnection(id);
    if (!existing || existing.organizationId !== ctx.organizationId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const ok = await disableSsoConnection(id);
    if (!ok) {
      return NextResponse.json({ error: "Already disabled" }, { status: 400 });
    }
    await recordAudit({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "sso.disabled",
      targetType: "sso_connection",
      targetId: id,
      targetLabel: existing.providerName,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
