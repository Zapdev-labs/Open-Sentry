import { NextResponse } from "next/server";
import { handleApiError, requireApiAuth } from "@/lib/api-v1-auth";
import { getOrganizationStats } from "@/lib/queries";

export async function GET(request: Request) {
  try {
    const auth = await requireApiAuth(request, "read");
    const stats = await getOrganizationStats(auth.organizationId);
    return NextResponse.json(stats);
  } catch (err) {
    return handleApiError(err);
  }
}
