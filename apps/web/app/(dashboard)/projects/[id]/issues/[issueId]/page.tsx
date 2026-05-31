import { notFound } from "next/navigation";
import type { StackFrame, Breadcrumb } from "@sentry-clone/db";
import { getIssue, getIssueEvents, getProject } from "@/lib/queries";
import { requireOrganizationId } from "@/lib/session-org";
import { ProjectNav } from "@/components/project-nav";
import { IssueActions } from "@/components/issue-actions";

interface PageProps {
  params: Promise<{ id: string; issueId: string }>;
}

function StackPanel({ frames }: { frames: StackFrame[] }) {
  if (frames.length === 0) {
    return <p className="meta">No stack trace available.</p>;
  }

  return (
    <div className="stack-trace">
      {frames.map((frame, i) => (
        <div key={i} className="stack-frame">
          <span className="code-block">
            {frame.function ?? "anonymous"}
          </span>
          {" at "}
          {frame.filename ?? "unknown"}
          {frame.lineno != null && `:${frame.lineno}`}
        </div>
      ))}
    </div>
  );
}

function BreadcrumbPanel({ crumbs }: { crumbs: Breadcrumb[] }) {
  if (crumbs.length === 0) {
    return <p className="meta">No breadcrumbs recorded.</p>;
  }

  return (
    <ul className="breadcrumb-timeline">
      {crumbs.map((crumb, i) => (
        <li key={i} className="breadcrumb-item">
          <span className="meta" style={{ fontSize: 12 }}>
            {crumb.category ?? "default"}
          </span>
          <div>{crumb.message ?? "—"}</div>
        </li>
      ))}
    </ul>
  );
}

export default async function IssueDetailPage({ params }: PageProps) {
  const { id, issueId } = await params;
  const organizationId = await requireOrganizationId();
  const project = await getProject(id, organizationId);
  if (!project) notFound();

  const issue = await getIssue(issueId);
  if (!issue || issue.projectId !== id) notFound();

  const eventList = await getIssueEvents(issueId);
  const latestEvent = eventList[0];

  return (
    <main>
      <ProjectNav projectId={id} active="issues" />

      <section className="container" style={{ paddingBottom: 64 }}>
        <div className="fade-in" style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span className={`badge badge-${issue.status}`}>{issue.status}</span>
            <span className={`badge badge-level-${issue.level === "error" ? "error" : "info"}`}>
              {issue.level}
            </span>
          </div>
          <h2 style={{ fontSize: 28 }}>{issue.title}</h2>
          <p className="meta" style={{ marginTop: 8 }}>
            {issue.eventCount} events · First seen {issue.firstSeen.toLocaleString()} · Last seen{" "}
            {issue.lastSeen.toLocaleString()}
          </p>
          <IssueActions issueId={issueId} status={issue.status} />
        </div>

        {latestEvent && (
          <div className="two-col fade-in">
            <div>
              <h3 style={{ fontSize: 18, marginBottom: 16 }}>Stack trace</h3>
              <StackPanel frames={latestEvent.stack} />
            </div>
            <div>
              <h3 style={{ fontSize: 18, marginBottom: 16 }}>Breadcrumbs</h3>
              <div className="card" style={{ padding: 20 }}>
                <BreadcrumbPanel crumbs={latestEvent.breadcrumbs} />
              </div>
            </div>
          </div>
        )}

        {eventList.length > 1 && (
          <div className="fade-in" style={{ marginTop: 48 }}>
            <h3 style={{ fontSize: 18, marginBottom: 16 }}>Recent events</h3>
            <table className="table-editorial">
              <thead>
                <tr>
                  <th>Message</th>
                  <th>Environment</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {eventList.slice(1).map((event) => (
                  <tr key={event.id}>
                    <td>{event.message}</td>
                    <td className="meta">{event.environment ?? "—"}</td>
                    <td className="meta">{event.timestamp.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
