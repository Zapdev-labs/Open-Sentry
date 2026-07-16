import { NextResponse } from "next/server";
import {
  handleApiError,
  requireApiAuth,
  requireProjectAccess,
} from "@/lib/api-v1-auth";
import {
  getAiGenerationByModel,
  getAiGenerationStats,
  getAiGenerationStatsToday,
  getAiGenerations,
} from "@/lib/queries";

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

    const [stats, today, byModel, generations] = await Promise.all([
      getAiGenerationStats(id),
      getAiGenerationStatsToday(id),
      getAiGenerationByModel(id),
      getAiGenerations(id, limit),
    ]);

    return NextResponse.json({ stats, today, byModel, generations });
  } catch (err) {
    return handleApiError(err);
  }
}
