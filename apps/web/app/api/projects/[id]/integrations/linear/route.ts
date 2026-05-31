import { NextResponse } from "next/server";
import { getProject } from "@/lib/queries";
import { getLinearIntegration, upsertLinearIntegration } from "@/lib/integrations";
import { requireOrganizationId } from "@/lib/session-org";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const organizationId = await requireOrganizationId();
    const { id } = await params;
    const project = await getProject(id, organizationId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const integration = await getLinearIntegration(id);
    return NextResponse.json(integration);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const organizationId = await requireOrganizationId();
    const { id } = await params;
    const project = await getProject(id, organizationId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      enabled?: boolean;
      teamId?: string;
      apiKey?: string;
    };

    const result = await upsertLinearIntegration(id, {
      enabled: body.enabled ?? false,
      teamId: body.teamId ?? "",
      apiKey: body.apiKey,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const integration = await getLinearIntegration(id);
    return NextResponse.json(integration);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
