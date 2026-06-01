import { NextResponse } from "next/server";
import { z } from "zod";
import { getProject } from "@/lib/queries";
import { requireOrganizationId } from "@/lib/session-org";
import { createDsnKey, listDsnKeys } from "@/lib/queries-tokens";
import { recordAudit } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const createSchema = z.object({
  environment: z.enum(["production", "staging", "development", "test", "custom"]),
  label: z.string().max(80).optional(),
});

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const organizationId = await requireOrganizationId();
    const project = await getProject(id, organizationId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const keys = await listDsnKeys(id);
    return NextResponse.json({ keys });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const organizationId = await requireOrganizationId();
    const project = await getProject(id, organizationId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const session = await (await import("@/lib/auth")).auth.api.getSession({
      headers: await (await import("next/headers")).headers(),
    });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await createDsnKey({
      projectId: id,
      environment: parsed.data.environment,
      label: parsed.data.label,
      createdBy: session.user.id,
    });

    await recordAudit({
      organizationId,
      action: "dsn.created",
      targetType: "dsn_key",
      targetId: result.key.id,
      targetLabel: `${parsed.data.environment}${parsed.data.label ? ` (${parsed.data.label})` : ""}`,
      metadata: {
        projectId: id,
        environment: parsed.data.environment,
        lastFour: result.key.publicKey.slice(-4),
      },
    });

    return NextResponse.json(
      { key: result.key, publicKey: result.publicKey, dsn: result.dsn },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
