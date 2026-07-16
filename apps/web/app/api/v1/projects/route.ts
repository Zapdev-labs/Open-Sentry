import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireApiAuth } from "@/lib/api-v1-auth";
import { createProject, getProjectSummaries } from "@/lib/queries";
import { recordAudit } from "@/lib/audit";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function GET(request: Request) {
  try {
    const auth = await requireApiAuth(request, "read");
    let projects = await getProjectSummaries(auth.organizationId);
    if (auth.projectId) {
      projects = projects.filter((p) => p.id === auth.projectId);
    }
    return NextResponse.json({ projects });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiAuth(request, "write");
    if (auth.projectId) {
      return NextResponse.json(
        { error: "Project-scoped tokens cannot create projects" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const project = await createProject(parsed.data.name, auth.organizationId);
    if (!project) {
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }

    await recordAudit({
      organizationId: auth.organizationId,
      actorId: auth.createdBy,
      action: "project.created",
      targetType: "project",
      targetId: project.id,
      targetLabel: project.name,
      metadata: { via: "api_v1" },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
