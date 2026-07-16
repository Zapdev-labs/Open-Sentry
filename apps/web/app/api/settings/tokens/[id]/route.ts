import { NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/permissions";
import { revokeApiToken } from "@/lib/queries-tokens";
import { recordAudit } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { organizationId } = await requireOrgAdmin();
    const { id } = await params;
    const ok = await revokeApiToken(organizationId, id);
    if (!ok) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }
    await recordAudit({
      organizationId,
      action: "api_token.revoked",
      targetType: "api_token",
      targetId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
