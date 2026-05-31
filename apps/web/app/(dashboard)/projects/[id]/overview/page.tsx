import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, getProjectOverview } from "@/lib/queries";
import { requireOrganizationId } from "@/lib/session-org";
import { PageHeaderBar } from "@/components/page-header-bar";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectOverviewPage({ params }: PageProps) {
  const { id } = await params;
  const organizationId = await requireOrganizationId();
  const project = await getProject(id, organizationId);
  if (!project) notFound();

  const overview = await getProjectOverview(id);

  return (
    <main className="dash-page">
      <PageHeaderBar title="Overview" />

      <div className="stats-grid fade-in" style={{ marginTop: 24, marginBottom: 32 }}>
        <div className="card stat-card">
          <div className="stat-value">{overview.openIssues}</div>
          <div className="stat-label">Open issues</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{overview.resolvedIssues}</div>
          <div className="stat-label">Resolved</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{overview.eventsToday}</div>
          <div className="stat-label">Events today</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{overview.transactionStats.p95}ms</div>
          <div className="stat-label">p95 latency</div>
        </div>
      </div>

      <div className="dashboard-grid fade-in">
        <div className="card">
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>Issue breakdown</h2>
          <div className="breakdown-list">
            <div className="breakdown-row">
              <span>Open</span>
              <strong>{overview.openIssues}</strong>
            </div>
            <div className="breakdown-row">
              <span>Resolved</span>
              <strong>{overview.resolvedIssues}</strong>
            </div>
            <div className="breakdown-row">
              <span>Ignored</span>
              <strong>{overview.ignoredIssues}</strong>
            </div>
            <div className="breakdown-row">
              <span>Total events</span>
              <strong>{overview.totalEvents}</strong>
            </div>
          </div>
        </div>
        <div className="card">
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>Performance snapshot</h2>
          <div className="breakdown-list">
            <div className="breakdown-row">
              <span>Transactions</span>
              <strong>{overview.transactionStats.count}</strong>
            </div>
            <div className="breakdown-row">
              <span>Average</span>
              <strong>{overview.transactionStats.avg}ms</strong>
            </div>
            <div className="breakdown-row">
              <span>p50</span>
              <strong>{overview.transactionStats.p50}ms</strong>
            </div>
            <div className="breakdown-row">
              <span>p95</span>
              <strong>{overview.transactionStats.p95}ms</strong>
            </div>
          </div>
        </div>
        <div className="card">
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>Quick links</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Link href={`/projects/${id}/issues`} className="nav-link">
              View all issues
            </Link>
            <Link href={`/projects/${id}/performance`} className="nav-link">
              Open performance
            </Link>
            <Link href={`/projects/${id}/settings`} className="nav-link">
              Project settings & DSN
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
