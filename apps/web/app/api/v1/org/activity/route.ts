import { NextResponse } from "next/server";
import { handleApiError, requireApiAuth } from "@/lib/api-v1-auth";
import { getRecentActivity } from "@/lib/queries";

export async function GET(request: Request) {
  try {
    const auth = await requireApiAuth(request, "read");
    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit");
    const limit = Math.min(Math.max(Number(limitRaw) || 8, 1), 50);
    const activity = await getRecentActivity(auth.organizationId, limit);
    return NextResponse.json({ activity });
  } catch (err) {
    return handleApiError(err);
  }
}
