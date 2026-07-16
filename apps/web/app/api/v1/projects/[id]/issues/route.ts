import { NextResponse } from "next/server";
import {
  handleApiError,
  requireApiAuth,
  requireProjectAccess,
} from "@/lib/api-v1-auth";
import { getIssues } from "@/lib/queries";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireApiAuth(request, "read");
    const { id } = await params;
    await requireProjectAccess(auth, id);

    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;
    const level = url.searchParams.get("level") ?? undefined;

    if (status && !["open", "resolved", "ignored"].includes(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }
    if (level && !["fatal", "error", "warning", "info", "debug"].includes(level)) {
      return NextResponse.json({ error: "Invalid level filter" }, { status: 400 });
    }

    const issues = await getIssues(id, status, level);
    return NextResponse.json({ issues });
  } catch (err) {
    return handleApiError(err);
  }
}
