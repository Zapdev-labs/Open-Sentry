import { NextResponse } from "next/server";
import {
  handleApiError,
  requireApiAuth,
  requireProjectAccess,
} from "@/lib/api-v1-auth";
import { buildDsn, getProjectOverview } from "@/lib/queries";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireApiAuth(request, "read");
    const { id } = await params;
    const project = await requireProjectAccess(auth, id);
    const overview = await getProjectOverview(project.id);

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        organizationId: project.organizationId,
        publicKey: project.publicKey,
        dsn: buildDsn(project.publicKey),
        createdAt: project.createdAt,
      },
      overview,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
