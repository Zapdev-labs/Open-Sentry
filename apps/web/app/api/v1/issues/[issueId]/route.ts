import { NextResponse } from "next/server";
import { z } from "zod";
import {
  handleApiError,
  requireApiAuth,
  requireIssueAccess,
} from "@/lib/api-v1-auth";
import { updateIssueStatus } from "@/lib/queries";

interface RouteParams {
  params: Promise<{ issueId: string }>;
}

const patchSchema = z.object({
  status: z.enum(["open", "resolved", "ignored"]),
});

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireApiAuth(request, "read");
    const { issueId } = await params;
    const issue = await requireIssueAccess(auth, issueId);
    return NextResponse.json({ issue });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireApiAuth(request, "write");
    const { issueId } = await params;
    await requireIssueAccess(auth, issueId);

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const updated = await updateIssueStatus(issueId, parsed.data.status);
    if (!updated) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    return NextResponse.json({ issue: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
