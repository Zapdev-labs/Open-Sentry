import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Bug, ChartLine, Gear, Pulse, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { ensureActiveOrganization } from "@/lib/session-org";
import {
  getOrganizationStats,
  getProjectSummaries,
  getRecentActivity,
} from "@/lib/queries";
import { CreateProjectForm } from "@/components/create-project-form";

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

  const statTiles = [
    { value: stats.projectCount, label: "Projects" },
    { value: stats.openIssues, label: "Open issues" },
    { value: stats.eventsToday, label: "Events today" },
    { value: `${stats.errorRate}%`, label: "Txn error rate" },
  ];

  return (
    <main className="dash-page">
      <header className="dash-page-header fade-in">
        <div>
          <h1 className="dash-page-title">Overview</h1>
          <p className="dash-page-subtitle">Workspace health across all projects in the last 24 hours.</p>
        </div>
      </header>

      <section className="dash-section fade-in">
        <div className="dash-stat-grid">
          {statTiles.map((tile) => (
            <div key={tile.label} className="dash-stat">
              <span className="dash-stat-value">{tile.value}</span>
              <span className="dash-stat-label">{tile.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="dash-section fade-in">
        <div className="dash-split">
          <article className="dash-card dash-card-wide">
            <div className="dash-card-head">
              <span className="dash-card-icon">
                <Bug size={18} weight="bold" />
              </span>
              <h2 className="dash-card-title">Error tracking</h2>
            </div>
            <p className="dash-card-body">
              {stats.totalIssues} grouped issues across your workspace. {stats.openIssues} still open
              and need attention.
            </p>
            <div className="dash-card-stats">
              <span>
                <WarningCircle size={15} weight="bold" /> {stats.openIssues} open
              </span>
              <span>
                <Pulse size={15} weight="bold" /> {stats.eventsToday} events today
              </span>
            </div>
          </article>
          <article className="dash-card">
            <div className="dash-card-head">
              <span className="dash-card-icon">
                <ChartLine size={18} weight="bold" />
              </span>
              <h2 className="dash-card-title">Performance</h2>
            </div>
            <p className="dash-card-body">
              {stats.transactionsToday} transactions in the last 24 hours with a {stats.errorRate}%
              failure rate.
            </p>
          </article>
        </div>
      </section>

      <section className="dash-section fade-in">
        <div className="dash-split">
          <article className="dash-card">
            <h2 className="dash-card-title">Create project</h2>
            <p className="dash-card-body">Spin up a new project and grab its DSN to start sending events.</p>
            <CreateProjectForm />
          </article>
          <article className="dash-card">
            <h2 className="dash-card-title">Recent activity</h2>
            {activity.length === 0 ? (
              <p className="dash-card-body">No events yet. Connect a project to start monitoring.</p>
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
          </article>
        </div>
      </section>

      {projectSummaries.length > 0 && (
        <section className="dash-section fade-in">
          <h2 className="dash-section-heading">Projects</h2>
          <div className="dash-project-grid">
            {projectSummaries.map((project, i) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}/overview`}
                className="dash-project-card stagger-item"
                style={{ "--index": i } as React.CSSProperties}
              >
                <div className="dash-project-card-head">
                  <h3 className="dash-project-card-title">{project.name}</h3>
                  <ArrowRight size={16} weight="bold" className="dash-project-card-arrow" />
                </div>
                <p className="dash-project-card-meta">
                  Created {project.createdAt.toLocaleDateString()}
                </p>
                <div className="dash-project-card-metrics">
                  <span>{project.openIssues} open</span>
                  <span className="issue-meta-sep">·</span>
                  <span>{project.totalEvents} events</span>
                  <span className="issue-meta-sep">·</span>
                  <span>{project.transactionCount} txns</span>
                </div>
                <div className="dash-project-card-links">
                  <span><Bug size={14} weight="bold" /> Issues</span>
                  <span><ChartLine size={14} weight="bold" /> Performance</span>
                  <span><Gear size={14} weight="bold" /> Settings</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
