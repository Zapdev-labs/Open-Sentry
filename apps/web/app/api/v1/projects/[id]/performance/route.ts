import { NextResponse } from "next/server";
import {
  handleApiError,
  requireApiAuth,
  requireProjectAccess,
} from "@/lib/api-v1-auth";
import { getTransactionStats, getTransactions } from "@/lib/queries";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireApiAuth(request, "read");
    const { id } = await params;
    await requireProjectAccess(auth, id);

    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100);
    const [stats, transactions] = await Promise.all([
      getTransactionStats(id),
      getTransactions(id, limit),
    ]);

    return NextResponse.json({ stats, transactions });
  } catch (err) {
    return handleApiError(err);
  }
}
