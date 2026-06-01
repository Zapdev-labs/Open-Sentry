import Link from "next/link";
import { Tag, GitBranch } from "@phosphor-icons/react/dist/ssr";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/queries";
import { getRelease, listIssuesForRelease } from "@/lib/queries-releases";
import { requireOrganizationId } from "@/lib/clerk-auth";
import { PageHeaderBar } from "@/components/page-header-bar";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; version: string }>;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function levelBadge(level: string): "error" | "warning" | "info" {
  if (level === "fatal" || level === "error") return "error";
  if (level === "warning") return "warning";
  return "info";
}

function statusBadge(status: string): "resolved" | "warning" | "info" {
  if (status === "resolved") return "resolved";
  if (status === "regressed") return "warning";
  return "info";
}

export default async function ReleaseDetailPage({ params }: PageProps) {
  const { id, version } = await params;
  const organizationId = await requireOrganizationId();
  const project = await getProject(id, organizationId);
  if (!project) notFound();

  const decodedVersion = decodeURIComponent(version);
  const release = await getRelease(id, decodedVersion);
  if (!release) notFound();

  const issuesList = await listIssuesForRelease(id, decodedVersion);

  return (
    <main className="dash-page">
      <PageHeaderBar title={release.version} />

      <div className="fade-in" style={{ marginTop: 24, marginBottom: 24 }}>
        <Link href={`/projects/${id}/releases`} className="meta" style={{ fontSize: 13 }}>
          ← All releases
        </Link>
      </div>

      <div
        className="card fade-in"
        style={{ marginBottom: 24, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}
      >
        <div>
          <p className="meta" style={{ fontSize: 12, marginBottom: 4 }}>
            Environment
          </p>
          <p style={{ fontSize: 16, fontWeight: 500 }}>{release.environment ?? "—"}</p>
        </div>
        <div>
          <p className="meta" style={{ fontSize: 12, marginBottom: 4 }}>
            Status
          </p>
          <span
            className={`badge badge-${statusBadge(release.status)}`}
            style={{ fontSize: 13 }}
          >
            {release.status}
          </span>
        </div>
        <div>
          <p className="meta" style={{ fontSize: 12, marginBottom: 4 }}>
            Date released
          </p>
          <p style={{ fontSize: 16, fontWeight: 500 }}>{formatDate(release.dateReleased)}</p>
        </div>
        <div>
          <p className="meta" style={{ fontSize: 12, marginBottom: 4 }}>
            New issues
          </p>
          <p
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: release.newIssueCount > 0 ? "var(--level-warning)" : undefined,
            }}
          >
            {release.newIssueCount}
          </p>
        </div>
        {release.ref ? (
          <div>
            <p className="meta" style={{ fontSize: 12, marginBottom: 4 }}>
              Git ref
            </p>
            <p
              style={{
                fontSize: 14,
                fontFamily: "var(--font-mono)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <GitBranch size={14} weight="bold" />
              {release.ref}
            </p>
          </div>
        ) : null}
        {release.url ? (
          <div style={{ gridColumn: release.ref ? undefined : "span 2" }}>
            <p className="meta" style={{ fontSize: 12, marginBottom: 4 }}>
              URL
            </p>
            <a
              href={release.url}
              target="_blank"
              rel="noreferrer"
              className="nav-link"
              style={{ fontSize: 14 }}
            >
              {release.url}
            </a>
          </div>
        ) : null}
        <div>
          <p className="meta" style={{ fontSize: 12, marginBottom: 4 }}>
            Created
          </p>
          <p style={{ fontSize: 14 }}>{formatDate(release.createdAt)}</p>
        </div>
      </div>

      <div className="card fade-in">
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>
          {issuesList.length === 0
            ? "No issues first seen in this release"
            : `${issuesList.length} issue${issuesList.length === 1 ? "" : "s"} first seen in this release`}
        </h2>
        {issuesList.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table className="table-editorial">
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Level</th>
                  <th>Status</th>
                  <th>Events</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {issuesList.map((issue) => (
                  <tr key={issue.id}>
                    <td style={{ fontWeight: 500 }}>
                      <Link
                        href={`/projects/${id}/issues/${issue.id}`}
                        style={{ color: "inherit", textDecoration: "none" }}
                      >
                        {issue.title}
                      </Link>
                    </td>
                    <td>
                      <span className={`badge badge-level-${levelBadge(issue.level)}`}>
                        {issue.level}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${statusBadge(issue.status)}`}>
                        {issue.status}
                      </span>
                    </td>
                    <td className="meta">{issue.eventCount}</td>
                    <td className="meta">{formatDate(issue.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="meta">
            Once issues first appear with this release version attached, they&apos;ll show up here.
            Make sure your SDK is configured with{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>Sentry.setRelease(&quot;{release.version}&quot;)</code>{" "}
            (or equivalent) to populate this list.
          </p>
        )}
      </div>

      {release.commits.length > 0 ? (
        <div className="card fade-in" style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>
            Commits <span className="meta">({release.commits.length})</span>
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {release.commits.map((commit) => (
              <li
                key={commit.id}
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid var(--dash-border)",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginBottom: 4,
                  }}
                >
                  {commit.id.slice(0, 7)}
                  {commit.author ? ` · ${commit.author}` : ""}
                </p>
                <p style={{ fontSize: 14, margin: 0 }}>{commit.message}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </main>
  );
}
