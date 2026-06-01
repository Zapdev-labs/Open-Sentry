import { NextResponse } from "next/server";
import { getProject } from "@/lib/queries";
import { requireOrganizationId } from "@/lib/clerk-auth";
import { revokeDsnKey } from "@/lib/queries-tokens";
import { recordAudit } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string; keyId: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id, keyId } = await params;
    const organizationId = await requireOrganizationId();
    const project = await getProject(id, organizationId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const ok = await revokeDsnKey(id, keyId);
    if (!ok) return NextResponse.json({ error: "DSN key not found" }, { status: 404 });
    await recordAudit({
      organizationId,
      action: "dsn.revoked",
      targetType: "dsn_key",
      targetId: keyId,
      targetLabel: project.name,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
