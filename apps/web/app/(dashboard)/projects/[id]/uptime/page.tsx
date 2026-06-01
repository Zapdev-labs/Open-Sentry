import { notFound } from "next/navigation";
import { ArrowUpRight, Pulse } from "@phosphor-icons/react/dist/ssr";
import { getProject } from "@/lib/queries";
import { getMonitorSummaries, getRecentIncidents, type MonitorSummary } from "@/lib/uptime";
import { requireOrganizationId } from "@/lib/clerk-auth";
import { PageHeaderBar } from "@/components/page-header-bar";
import { CreateMonitorForm, DeleteMonitorButton } from "@/components/uptime-monitor-controls";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const statusLabel: Record<string, string> = {
  up: "Operational",
  down: "Down",
  paused: "Paused",
  unknown: "Pending",
};

function intervalLabel(seconds: number): string {
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

function relativeTime(date: Date | null): string {
  if (!date) return "never";
  const diff = Date.now() - date.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function MonitorCard({ summary, projectId }: { summary: MonitorSummary; projectId: string }) {
  const { monitor, uptime24h, avgResponseMs, recentChecks, openIncident, checkCount } = summary;
  const status = monitor.currentStatus;

  return (
    <article className="uptime-card">
      <div className="uptime-card-head">
        <div className="uptime-card-identity">
          <span className={`uptime-status-dot uptime-status-${status}`} />
          <div>
            <h3 className="uptime-card-name">{monitor.name}</h3>
            <a
              href={monitor.url}
              target="_blank"
              rel="noreferrer"
              className="uptime-card-url"
            >
              {monitor.method} {monitor.url}
              <ArrowUpRight size={12} weight="bold" />
            </a>
          </div>
        </div>
        <div className="uptime-card-head-right">
          <span className={`uptime-pill uptime-pill-${status}`}>{statusLabel[status]}</span>
          <DeleteMonitorButton projectId={projectId} monitorId={monitor.id} />
        </div>
      </div>

      <div className="uptime-strip" aria-label="Recent checks">
        {recentChecks.length === 0 ? (
          <span className="uptime-strip-empty">Awaiting first check…</span>
        ) : (
          recentChecks.map((check, i) => (
            <span
              key={i}
              className={`uptime-strip-tick uptime-strip-${check.status}`}
              title={`${check.status} · ${check.checkedAt.toLocaleString()}`}
            />
          ))
        )}
      </div>

      <div className="uptime-card-metrics">
        <div>
          <span className="uptime-metric-value">{uptime24h}%</span>
          <span className="uptime-metric-label">Uptime 24h</span>
        </div>
        <div>
          <span className="uptime-metric-value">{avgResponseMs === null ? "—" : `${avgResponseMs}ms`}</span>
          <span className="uptime-metric-label">Avg response</span>
        </div>
        <div>
          <span className="uptime-metric-value">{intervalLabel(monitor.intervalSeconds)}</span>
          <span className="uptime-metric-label">Interval</span>
        </div>
        <div>
          <span className="uptime-metric-value">{relativeTime(monitor.lastCheckedAt)}</span>
          <span className="uptime-metric-label">Last check ({checkCount})</span>
        </div>
      </div>

      {openIncident && (
        <div className="uptime-incident">
          <strong>Down since {openIncident.startedAt.toLocaleString()}</strong>
          {openIncident.cause ? ` — ${openIncident.cause}` : ""}
        </div>
      )}
    </article>
  );
}

export default async function UptimePage({ params }: PageProps) {
  const { id } = await params;
  const organizationId = await requireOrganizationId();
  const project = await getProject(id, organizationId);
  if (!project) notFound();

  const summaries = await getMonitorSummaries(id);
  const incidents = await getRecentIncidents(
    id,
    summaries.map((s) => s.monitor.id)
  );
  const monitorName = new Map(summaries.map((s) => [s.monitor.id, s.monitor.name]));

  return (
    <main className="dash-page">
      <PageHeaderBar title="Uptime" />

      {summaries.length === 0 ? (
        <div className="uptime-empty fade-in">
          <span className="uptime-empty-icon">
            <Pulse size={28} weight="bold" />
          </span>
          <h2>Monitor your endpoints</h2>
          <p className="dash-card-body">
            Add a URL and we&apos;ll probe it on a schedule from the worker fleet. Consecutive
            failures open an incident automatically.
          </p>
        </div>
      ) : (
        <section className="dash-section fade-in">
          <div className="uptime-grid">
            {summaries.map((summary) => (
              <MonitorCard key={summary.monitor.id} summary={summary} projectId={id} />
            ))}
          </div>
        </section>
      )}

      <section className="dash-section fade-in">
        <h2 className="dash-section-heading">Add a monitor</h2>
        <div className="dash-card">
          <CreateMonitorForm projectId={id} />
        </div>
      </section>

      {incidents.length > 0 && (
        <section className="dash-section fade-in">
          <h2 className="dash-section-heading">Recent incidents</h2>
          <ul className="uptime-incident-list">
            {incidents.map((incident) => (
              <li key={incident.id} className="uptime-incident-row">
                <span className={`uptime-status-dot uptime-status-${incident.resolvedAt ? "up" : "down"}`} />
                <span className="uptime-incident-name">{monitorName.get(incident.monitorId) ?? "Monitor"}</span>
                <span className="uptime-incident-cause">{incident.cause ?? "Check failed"}</span>
                <span className="uptime-incident-time">
                  {incident.resolvedAt
                    ? `Resolved ${incident.resolvedAt.toLocaleString()}`
                    : `Ongoing since ${incident.startedAt.toLocaleString()}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
