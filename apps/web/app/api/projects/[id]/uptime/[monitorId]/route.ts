import { NextResponse } from "next/server";
import { getProject } from "@/lib/queries";
import { deleteUptimeMonitor } from "@/lib/uptime";
import { requireOrganizationId } from "@/lib/session-org";

interface RouteParams {
  params: Promise<{ id: string; monitorId: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const organizationId = await requireOrganizationId();
    const { id, monitorId } = await params;
    const project = await getProject(id, organizationId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const deleted = await deleteUptimeMonitor(id, monitorId);
    if (!deleted) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
