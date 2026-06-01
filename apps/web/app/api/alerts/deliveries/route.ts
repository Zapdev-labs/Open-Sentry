import { NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/clerk-auth";
import { listAlertDeliveries } from "@/lib/queries-alerts";

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireOrgMember();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1),
      200
    );
    const ruleId = searchParams.get("ruleId") ?? undefined;
    const channelId = searchParams.get("channelId") ?? undefined;
    const deliveries = await listAlertDeliveries({
      organizationId,
      ruleId,
      channelId,
      limit,
    });
    return NextResponse.json({ deliveries });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
