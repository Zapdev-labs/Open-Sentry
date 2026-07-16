import { NextResponse } from "next/server";
import {
  handleApiError,
  requireApiAuth,
  requireIssueAccess,
} from "@/lib/api-v1-auth";
import { getIssueEventTimeline, getIssueEvents } from "@/lib/queries";

interface RouteParams {
  params: Promise<{ issueId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireApiAuth(request, "read");
    const { issueId } = await params;
    await requireIssueAccess(auth, issueId);

    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100);

    const [events, timeline] = await Promise.all([
      getIssueEvents(issueId, cursor, limit),
      getIssueEventTimeline(issueId),
    ]);

    return NextResponse.json({ events, timeline });
  } catch (err) {
    return handleApiError(err);
  }
}
