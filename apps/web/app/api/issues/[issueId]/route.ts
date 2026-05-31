import { NextResponse } from "next/server";
import { updateIssueStatus } from "@/lib/queries";

interface RouteParams {
  params: Promise<{ issueId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { issueId } = await params;
  const body = (await request.json()) as { status?: string };

  if (!body.status || !["open", "resolved", "ignored"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await updateIssueStatus(
    issueId,
    body.status as "open" | "resolved" | "ignored"
  );

  if (!updated) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
