import { NextResponse } from "next/server";
import { handleApiError, requireApiAuth } from "@/lib/api-v1-auth";

export async function GET(request: Request) {
  try {
    const auth = await requireApiAuth(request, "read");
    return NextResponse.json({
      organizationId: auth.organizationId,
      projectId: auth.projectId,
      scope: auth.scope,
      name: auth.name,
      lastFour: auth.lastFour,
      expiresAt: auth.expiresAt,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
