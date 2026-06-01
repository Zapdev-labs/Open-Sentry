import { NextResponse } from "next/server";
import { getProject } from "@/lib/queries";
import { getRelease, deleteRelease, listIssuesForRelease } from "@/lib/queries-releases";
import { requireOrgMember } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ id: string; version: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const ctx = await requireOrgMember();
    const { id, version } = await params;
    const project = await getProject(id, ctx.organizationId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const decodedVersion = decodeURIComponent(version);
    const release = await getRelease(id, decodedVersion);
    if (!release) {
      return NextResponse.json({ error: "Release not found" }, { status: 404 });
    }

    const issuesList = await listIssuesForRelease(id, decodedVersion);
    return NextResponse.json({ release, issues: issuesList });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const ctx = await requireOrgMember();
    const { id, version } = await params;
    const project = await getProject(id, ctx.organizationId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!["admin", "manager", "owner"].includes(ctx.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const decodedVersion = decodeURIComponent(version);
    const ok = await deleteRelease(id, decodedVersion);
    if (!ok) {
      return NextResponse.json({ error: "Release not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
