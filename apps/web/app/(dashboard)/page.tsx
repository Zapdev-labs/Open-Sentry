import Link from "next/link";
import { Bug, ChartLine, Gear, Pulse, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { ensureActiveOrganization } from "@/lib/session-org";
import {
  getOrganizationStats,
  getProjectSummaries,
  getRecentActivity,
} from "@/lib/queries";
import { CreateProjectForm } from "@/components/create-project-form";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const orgContext = await ensureActiveOrganization();
  if (!orgContext) redirect("/login");

  const { organizationId } = orgContext;
  const [stats, projectSummaries, activity] = await Promise.all([
    getOrganizationStats(organizationId),
    getProjectSummaries(organizationId),
    getRecentActivity(organizationId),
  ]);

  return (
    <main>
      <header className="container page-header fade-in">
        <h1 style={{ fontSize: 42 }}>Overview</h1>
        <p className="meta" style={{ marginTop: 12 }}>
          Workspace health across all projects in the last 24 hours.
        </p>
      </header>

      <section className="container" style={{ paddingBottom: 48 }}>
        <div className="stats-grid fade-in" style={{ marginBottom: 32 }}>
          <div className="card stat-card">
            <div className="stat-value">{stats.projectCount}</div>
            <div className="stat-label">Projects</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value">{stats.openIssues}</div>
            <div className="stat-label">Open issues</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value">{stats.eventsToday}</div>
            <div className="stat-label">Events today</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value">{stats.errorRate}%</div>
            <div className="stat-label">Txn error rate</div>
          </div>
        </div>

        <div className="dashboard-grid fade-in" style={{ marginBottom: 32 }}>
          <div className="card" style={{ gridColumn: "span 2" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <Bug size={24} weight="bold" />
              <h2 style={{ fontSize: 20 }}>Error Tracking</h2>
            </div>
            <p className="meta" style={{ marginBottom: 16 }}>
              {stats.totalIssues} grouped issues across your workspace. {stats.openIssues} still
              open and need attention.
            </p>
            <div className="inline-stats">
              <span>
                <WarningCircle size={16} weight="bold" /> {stats.openIssues} open
              </span>
              <span>
                <Pulse size={16} weight="bold" /> {stats.eventsToday} events today
              </span>
            </div>
          </div>
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <ChartLine size={24} weight="bold" />
              <h2 style={{ fontSize: 20 }}>Performance</h2>
            </div>
            <p className="meta">
              {stats.transactionsToday} transactions recorded in the last 24 hours with a{" "}
              {stats.errorRate}% failure rate.
            </p>
          </div>
        </div>

        <div className="two-col" style={{ marginBottom: 32 }}>
          <div className="card fade-in">
            <h2 style={{ fontSize: 20, marginBottom: 20 }}>Create project</h2>
            <CreateProjectForm />
          </div>
          <div className="card fade-in">
            <h2 style={{ fontSize: 20, marginBottom: 16 }}>Recent activity</h2>
            {activity.length === 0 ? (
              <p className="meta">No events yet. Connect a project to start monitoring.</p>
            ) : (
              <ul className="activity-feed">
                {activity.map((item) => (
                  <li key={item.id} className="activity-item">
                    <div>
                      <span className="activity-project">{item.projectName}</span>
                      <p className="activity-message">{item.message}</p>
                    </div>
                    <span className="meta">{item.timestamp.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {projectSummaries.length > 0 && (
          <>
            <h2 style={{ fontSize: 24, marginBottom: 16 }}>Projects</h2>
            <div className="bento-grid">
              {projectSummaries.map((project, i) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}/overview`}
                  className="card stagger-item project-card"
                  style={{ "--index": i } as React.CSSProperties}
                >
                  <h3 style={{ fontSize: 18, marginBottom: 8 }}>{project.name}</h3>
                  <p className="meta" style={{ fontSize: 13 }}>
                    Created {project.createdAt.toLocaleDateString()}
                  </p>
                  <div className="project-metrics">
                    <span>{project.openIssues} open</span>
                    <span>{project.totalEvents} events</span>
                    <span>{project.transactionCount} txns</span>
                  </div>
                  <div style={{ marginTop: 16, display: "flex", gap: 16 }}>
                    <span className="nav-link" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Bug size={16} weight="bold" /> Issues
                    </span>
                    <span className="nav-link" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <ChartLine size={16} weight="bold" /> Performance
                    </span>
                    <span className="nav-link" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Gear size={16} weight="bold" /> Settings
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
