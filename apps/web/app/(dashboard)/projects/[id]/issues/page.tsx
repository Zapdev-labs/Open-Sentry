import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getIssues, getProject } from "@/lib/queries";
import { requireOrganizationId } from "@/lib/session-org";
import { ProjectNav } from "@/components/project-nav";
import { IssueActions } from "@/components/issue-actions";
import { IssueFilters } from "@/components/issue-filters";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; level?: string }>;
}

function statusBadge(status: string) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

function levelBadge(level: string) {
  const cls =
    level === "error" || level === "fatal"
      ? "badge-level-error"
      : level === "warning"
        ? "badge-level-warning"
        : "badge-level-info";
  return <span className={`badge ${cls}`}>{level}</span>;
}

export default async function IssuesPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { status, level } = await searchParams;
  const organizationId = await requireOrganizationId();
  const project = await getProject(id, organizationId);
  if (!project) notFound();

  const issueList = await getIssues(id, status, level);

  return (
    <main>
      <ProjectNav projectId={id} active="issues" />

      <section className="container" style={{ paddingBottom: 64 }}>
        <Suspense fallback={null}>
          <IssueFilters projectId={id} />
        </Suspense>

        {issueList.length === 0 ? (
          <div className="card fade-in" style={{ marginTop: 24 }}>
            <p className="meta">No issues match these filters. Send an error from your application to get started.</p>
          </div>
        ) : (
          <table className="table-editorial fade-in" style={{ marginTop: 24 }}>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Status</th>
                <th>Level</th>
                <th>Events</th>
                <th>Last seen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {issueList.map((issue, i) => (
                <tr key={issue.id} className="stagger-item" style={{ "--index": i } as React.CSSProperties}>
                  <td>
                    <Link
                      href={`/projects/${id}/issues/${issue.id}`}
                      style={{ fontWeight: 500 }}
                    >
                      {issue.title}
                    </Link>
                  </td>
                  <td>{statusBadge(issue.status)}</td>
                  <td>{levelBadge(issue.level)}</td>
                  <td className="meta">{issue.eventCount}</td>
                  <td className="meta">{issue.lastSeen.toLocaleString()}</td>
                  <td>
                    <IssueActions issueId={issue.id} status={issue.status} compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
