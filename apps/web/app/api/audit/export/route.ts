import { and, desc, eq } from "drizzle-orm";
import { getDb, auditLog } from "@sentry-clone/db";
import { requireOrganizationId } from "@/lib/clerk-auth";
import { recordAudit } from "@/lib/audit";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "string"
        ? value
        : JSON.stringify(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  try {
    const organizationId = await requireOrganizationId();
    const rows = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.organizationId, organizationId))
      .orderBy(desc(auditLog.createdAt))
      .limit(10000);

    const header = [
      "created_at",
      "action",
      "actor_email",
      "target_type",
      "target_id",
      "target_label",
      "ip_address",
      "metadata",
    ];
    const body = rows.map((r) =>
      [
        r.createdAt,
        r.action,
        r.actorEmail,
        r.targetType,
        r.targetId,
        r.targetLabel,
        r.ipAddress,
        r.metadata,
      ]
        .map(csvEscape)
        .join(",")
    );
    const csv = [header.join(","), ...body].join("\n");

    void recordAudit({
      organizationId,
      action: "data.exported",
      targetType: "audit_log",
      targetLabel: "CSV export",
      metadata: { rowCount: rows.length },
    });

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-log-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      },
    });
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
}
