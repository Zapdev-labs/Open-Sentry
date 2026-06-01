import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, auditLog } from "@sentry-clone/db";
import { requireOrganizationId } from "@/lib/clerk-auth";
import { PageHeaderBar } from "@/components/page-header-bar";
import { AuditLogTable } from "@/components/audit-log-table";
import { AuditLogFilters } from "@/components/audit-log-filters";

export const dynamic = "force-dynamic";

const ALL_ACTIONS = [
  "member.invited",
  "member.removed",
  "member.role_changed",
  "project.created",
  "project.deleted",
  "project.settings_updated",
  "api_token.created",
  "api_token.revoked",
  "dsn.created",
  "dsn.revoked",
  "sso.configured",
  "sso.disabled",
  "scim.token_created",
  "scim.token_revoked",
  "release.created",
  "alert_rule.created",
  "alert_rule.updated",
  "alert_rule.deleted",
  "alert_channel.created",
  "alert_channel.deleted",
  "retention.updated",
  "data.exported",
] as const;

interface PageProps {
  searchParams: Promise<{
    action?: string;
    actor?: string;
    since?: string;
    until?: string;
  }>;
}

export default async function AuditLogPage({ searchParams }: PageProps) {
  const organizationId = await requireOrganizationId();
  const sp = await searchParams;

  const conditions = [eq(auditLog.organizationId, organizationId)];
  if (sp.action && (ALL_ACTIONS as readonly string[]).includes(sp.action)) {
    conditions.push(eq(auditLog.action, sp.action as never));
  }
  if (sp.actor) conditions.push(eq(auditLog.actorId, sp.actor));

  const [rows, totalRows] = await Promise.all([
    getDb()
      .select()
      .from(auditLog)
      .where(and(...conditions))
      .orderBy(desc(auditLog.createdAt))
      .limit(200),
    getDb()
      .select({ total: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(and(...conditions)),
  ]);
  const total = totalRows[0]?.total ?? 0;

  return (
    <main className="dash-page">
      <PageHeaderBar title="Audit log" />

      <div className="fade-in" style={{ marginTop: 24, marginBottom: 24 }}>
        <p className="meta">
          Every org-level change is recorded here for security and compliance review. Older than 90
          days is pruned automatically.
        </p>
      </div>

      <div className="card fade-in" style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <h2 style={{ fontSize: 20 }}>Recent activity</h2>
          <a
            href="/api/audit/export"
            className="btn btn-secondary"
            download
            style={{ textDecoration: "none" }}
          >
            Export CSV
          </a>
        </div>

        <AuditLogFilters actions={ALL_ACTIONS} initial={sp} />

        <AuditLogTable
          rows={rows}
          total={total}
          shown={rows.length}
        />
      </div>
    </main>
  );
}
