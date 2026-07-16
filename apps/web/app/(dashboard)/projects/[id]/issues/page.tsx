import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getIssues, getProject } from "@/lib/queries";
import { requireOrganizationId } from "@/lib/session-org";
import { IssueActions } from "@/components/issue-actions";
import { IssueFilters } from "@/components/issue-filters";
import { IssuesEmptyState } from "@/components/issues-empty-state";
import { PageHeaderBar } from "@/components/page-header-bar";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; level?: string; q?: string }>;
}

function levelDot(level: string) {
  const cls =
    level === "error" || level === "fatal"
      ? "issue-level-error"
      : level === "warning"
        ? "issue-level-warning"
        : "issue-level-info";
  return <span className={`issue-level-dot ${cls}`} aria-hidden="true" />;
}

function formatRelative(date: Date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function IssuesPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { status, level, q } = await searchParams;
  const organizationId = await requireOrganizationId();
  const project = await getProject(id, organizationId);
  if (!project) notFound();

  let issueList = await getIssues(id, status, level);
  if (q) {
    const needle = q.toLowerCase();
    issueList = issueList.filter((issue) => issue.title.toLowerCase().includes(needle));
  }

  return (
    <main className="dash-page">
      <PageHeaderBar title="Feed" />

      <Suspense fallback={null}>
        <IssueFilters projectId={id} projectName={project.name} />
      </Suspense>

      <div className="issues-feed">
        {issueList.length === 0 ? (
          <IssuesEmptyState />
        ) : (
          <ul className="issue-list">
            {issueList.map((issue, i) => (
              <li
                key={issue.id}
                className="issue-row stagger-item"
                style={{ "--index": i } as React.CSSProperties}
              >
                <div className="issue-row-main">
                  {levelDot(issue.level)}
                  <div className="issue-row-content">
                    <Link href={`/projects/${id}/issues/${issue.id}`} className="issue-row-title">
                      {issue.title}
                    </Link>
                    <div className="issue-row-meta">
                      <span className={`issue-status issue-status-${issue.status}`}>
                        {issue.status}
                      </span>
                      <span className="issue-meta-sep">·</span>
                      <span>{issue.eventCount} events</span>
                    </div>
                  </div>
                </div>
                <div className="issue-row-right">
                  <span className="issue-last-seen">{formatRelative(issue.lastSeen)}</span>
                  <IssueActions issueId={issue.id} status={issue.status} compact />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {issueList.length > 0 && (
        <div className="issues-pagination">
          <button type="button" className="issues-page-btn" disabled aria-label="Previous page">
            ‹
          </button>
          <button type="button" className="issues-page-btn" disabled aria-label="Next page">
            ›
          </button>
        </div>
      )}
    </main>
  );
}
