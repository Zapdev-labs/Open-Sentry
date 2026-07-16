import { NextResponse } from "next/server";
import { z } from "zod";
import { getProject } from "@/lib/queries";
import { listReleases, createRelease } from "@/lib/queries-releases";
import { requireOrgMember } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";

const createSchema = z.object({
  version: z.string().min(1).max(200),
  ref: z.string().max(200).optional(),
  environment: z.string().max(100).optional(),
  url: z.string().url().optional(),
  dateReleased: z.string().datetime().optional(),
  commits: z
    .array(
      z.object({
        id: z.string(),
        message: z.string(),
        author: z.string().optional(),
      })
    )
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const ctx = await requireOrgMember();
    const { id } = await params;
    const project = await getProject(id, ctx.organizationId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const rows = await listReleases(id);
    return NextResponse.json({ releases: rows });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const ctx = await requireOrgMember();
    const { id } = await params;
    const project = await getProject(id, ctx.organizationId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const raw = (await request.json()) as unknown;
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const release = await createRelease({
      projectId: id,
      version: parsed.data.version.trim(),
      ref: parsed.data.ref,
      environment: parsed.data.environment,
      url: parsed.data.url,
      dateReleased: parsed.data.dateReleased ? new Date(parsed.data.dateReleased) : undefined,
      commits: parsed.data.commits,
      metadata: parsed.data.metadata,
      createdBy: ctx.userId,
    });

    await recordAudit({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "release.created",
      targetType: "release",
      targetId: release.id,
      targetLabel: release.version,
      metadata: { projectId: id },
    });

    return NextResponse.json(release, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) {
      return NextResponse.json(
        { error: "A release with that version already exists for this project" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
