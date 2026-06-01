import { NextResponse } from "next/server";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { getDb, auditLog } from "@sentry-clone/db";
import { requireOrganizationId } from "@/lib/session-org";

export async function GET(request: Request) {
  try {
    const organizationId = await requireOrganizationId();
    const { searchParams } = new URL(request.url);

    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 1), 500);
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);
    const actionFilter = searchParams.get("action");
    const actorFilter = searchParams.get("actor");
    const since = searchParams.get("since");
    const until = searchParams.get("until");

    const conditions = [eq(auditLog.organizationId, organizationId)];
    if (actionFilter) conditions.push(eq(auditLog.action, actionFilter as never));
    if (actorFilter) conditions.push(eq(auditLog.actorId, actorFilter));
    if (since) {
      const d = new Date(since);
      if (!Number.isNaN(d.getTime())) conditions.push(gte(auditLog.createdAt, d));
    }
    if (until) {
      const d = new Date(until);
      if (!Number.isNaN(d.getTime())) conditions.push(lt(auditLog.createdAt, d));
    }

    const rows = await getDb()
      .select()
      .from(auditLog)
      .where(and(...conditions))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);

    const totalRows = await getDb()
      .select({ total: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(and(...conditions));
    const total = totalRows[0]?.total ?? 0;

    return NextResponse.json({ entries: rows, total, limit, offset });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
