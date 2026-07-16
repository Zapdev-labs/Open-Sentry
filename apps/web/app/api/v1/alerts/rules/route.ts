import { NextResponse } from "next/server";
import { handleApiError, requireApiAuth } from "@/lib/api-v1-auth";
import { listAlertRules } from "@/lib/queries-alerts";

export async function GET(request: Request) {
  try {
    const auth = await requireApiAuth(request, "read");
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId") ?? undefined;

    if (auth.projectId && projectId && auth.projectId !== projectId) {
      return NextResponse.json(
        { error: "Token is scoped to a different project" },
        { status: 403 }
      );
    }

    const rules = await listAlertRules(auth.organizationId, {
      projectId: auth.projectId ?? projectId,
    });

    return NextResponse.json({ rules });
  } catch (err) {
    return handleApiError(err);
  }
}
