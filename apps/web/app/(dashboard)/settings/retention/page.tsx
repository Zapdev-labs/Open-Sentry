import { notFound } from "next/navigation";
import { requireOrganizationId } from "@/lib/session-org";
import { listRetentionPolicies } from "@/lib/queries-retention";
import { getProjects } from "@/lib/queries";
import { PageHeaderBar } from "@/components/page-header-bar";
import { RetentionView } from "@/components/retention-view";

export const dynamic = "force-dynamic";

export default async function RetentionPage() {
  const organizationId = await requireOrganizationId();
  const [policies, projectsList] = await Promise.all([
    listRetentionPolicies(organizationId),
    getProjects(organizationId),
  ]);

  if (projectsList === null) notFound();

  return (
    <main className="dash-page">
      <PageHeaderBar title="Data retention" />

      <div className="fade-in" style={{ marginTop: 24, marginBottom: 24 }}>
        <p className="meta">
          Automatically delete old events, transactions, AI generation logs, and uptime probe
          results. Project-specific policies override the organization default for the same data
          type.
        </p>
      </div>

      <div className="fade-in">
        <RetentionView
          initialPolicies={policies.map((p) => ({
            id: p.id,
            projectId: p.projectId,
            projectName: p.projectName,
            dataType: p.dataType,
            retentionDays: p.retentionDays,
            enabled: p.enabled,
            lastPrunedAt: p.lastPrunedAt,
            updatedAt: p.updatedAt,
          }))}
          projects={projectsList.map((p) => ({ id: p.id, name: p.name }))}
        />
      </div>
    </main>
  );
}
