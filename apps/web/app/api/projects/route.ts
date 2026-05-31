import { NextResponse } from "next/server";
import { createProject } from "@/lib/queries";
import { requireOrganizationId } from "@/lib/session-org";

export async function POST(request: Request) {
  try {
    const organizationId = await requireOrganizationId();
    const body = (await request.json()) as { name?: string };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const project = await createProject(body.name.trim(), organizationId);
    if (!project) {
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }

    return NextResponse.json(project, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
