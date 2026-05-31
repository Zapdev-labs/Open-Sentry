import { notFound } from "next/navigation";
import { getIssue, getIssueEvents, getIssueEventTimeline, getProject } from "@/lib/queries";
import { requireOrganizationId } from "@/lib/session-org";
import { PageHeaderBar } from "@/components/page-header-bar";
import { IssueActions } from "@/components/issue-actions";
import { IssueEventExplorer } from "@/components/issue-event-explorer";
import { IssueTimelineChart } from "@/components/issue-timeline-chart";

interface PageProps {
  params: Promise<{ id: string; issueId: string }>;
}

function levelBadgeClass(level: string): string {
  if (level === "error" || level === "fatal") return "badge-level-error";
  if (level === "warning") return "badge-level-warning";
  return "badge-level-info";
}

export default async function IssueDetailPage({ params }: PageProps) {
  const { id, issueId } = await params;
  const organizationId = await requireOrganizationId();
  const project = await getProject(id, organizationId);
  if (!project) notFound();

  const issue = await getIssue(issueId);
  if (!issue || issue.projectId !== id) notFound();

  const [eventList, timeline] = await Promise.all([
    getIssueEvents(issueId),
    getIssueEventTimeline(issueId),
  ]);

  return (
    <main className="dash-page">
      <PageHeaderBar title="Issue detail" />

      <section style={{ paddingBottom: 64 }}>
        <div className="fade-in" style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span className={`badge badge-${issue.status}`}>{issue.status}</span>
            <span className={`badge ${levelBadgeClass(issue.level)}`}>{issue.level}</span>
          </div>
          <h2 style={{ fontSize: 28 }}>{issue.title}</h2>
          <p className="meta" style={{ marginTop: 8 }}>
            {issue.eventCount} events · First seen {issue.firstSeen.toLocaleString()} · Last seen{" "}
            {issue.lastSeen.toLocaleString()}
          </p>
          <IssueActions issueId={issueId} status={issue.status} />
        </div>

        <div className="fade-in" style={{ marginBottom: 32 }}>
          <IssueTimelineChart points={timeline} total={issue.eventCount} />
        </div>

        <div className="fade-in">
          <h3 style={{ fontSize: 18, marginBottom: 16 }}>Event details</h3>
          <IssueEventExplorer events={eventList} />
        </div>
      </section>
    </main>
  );
}
