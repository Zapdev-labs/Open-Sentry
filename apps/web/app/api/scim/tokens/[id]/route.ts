import { NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/permissions";
import { revokeScimToken } from "@/lib/queries-scim";
import { recordAudit } from "@/lib/audit";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireOrgAdmin();
    const { id } = await params;
    const ok = await revokeScimToken(id, ctx.organizationId);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await recordAudit({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "scim.token_revoked",
      targetType: "scim_token",
      targetId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
