"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash, ArrowRight, Tag, GitBranch, Warning } from "@phosphor-icons/react";
import type { ReleaseRow as ReleaseRowType } from "./create-release-form";

interface ReleasesTableProps {
  projectId?: string;
  initialReleases: ReleaseRowType[];
  showProject?: boolean;
}

function statusToBadge(status: string): "info" | "warning" | "resolved" {
  if (status === "shipped") return "resolved";
  if (status === "archived") return "info";
  return "warning";
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

export function ReleasesTable({ projectId, initialReleases, showProject }: ReleasesTableProps) {
  const router = useRouter();
  const [releases, setReleases] = useState(initialReleases);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = releases.filter((r) => {
    if (statusFilter === "all") return true;
    return r.status === statusFilter;
  });

  function handleFilterChange(value: string) {
    setStatusFilter(value);
    startTransition(() => {
      const url = new URL(window.location.href);
      if (value === "all") url.searchParams.delete("status");
      else url.searchParams.set("status", value);
      window.history.replaceState({}, "", url);
    });
  }

  async function handleDelete(release: ReleaseRowType) {
    if (!projectId) return;
    if (
      !window.confirm(
        `Delete release ${release.version}? This removes its links to issues but does not delete the issues themselves.`
      )
    ) {
      return;
    }
    setDeletingId(release.id);
    const res = await fetch(
      `/api/projects/${projectId}/releases/${encodeURIComponent(release.version)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setReleases((cur) => cur.filter((r) => r.id !== release.id));
      router.refresh();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(data.error ?? "Failed to delete release");
    }
    setDeletingId(null);
  }

  if (releases.length === 0) {
    return (
      <div className="card fade-in" style={{ textAlign: "center", padding: 48 }}>
        <Tag size={32} weight="bold" style={{ color: "var(--text-muted)", marginBottom: 12 }} />
        <h3 style={{ fontSize: 18, marginBottom: 8 }}>No releases yet</h3>
        <p className="meta">
          Create a release to track when issues first appeared, detect regressions, and link
          deployments to error spikes.
        </p>
      </div>
    );
  }

  return (
    <div className="card fade-in">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontSize: 20, margin: 0 }}>
          {releases.length} release{releases.length === 1 ? "" : "s"}
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label htmlFor="status-filter" className="meta">
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => handleFilterChange(e.target.value)}
            style={{ minWidth: 140 }}
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="shipped">Shipped</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="table-editorial">
          <thead>
            <tr>
              <th>Version</th>
              {showProject ? <th>Project</th> : null}
              <th>Environment</th>
              <th>Status</th>
              <th>New issues</th>
              <th>Released</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((release) => {
              const targetProjectId = projectId ?? release.projectId;
              const link = targetProjectId
                ? `/projects/${targetProjectId}/releases/${encodeURIComponent(release.version)}`
                : "#";
              return (
                <tr key={release.id}>
                  <td style={{ fontWeight: 500 }}>
                    <Link href={link} style={{ color: "inherit", textDecoration: "none" }}>
                      {release.version}
                    </Link>
                    {release.ref ? (
                      <span
                        className="meta"
                        style={{
                          marginLeft: 8,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <GitBranch size={12} weight="bold" />
                        {release.ref}
                      </span>
                    ) : null}
                  </td>
                  {showProject ? (
                    <td className="meta">{release.projectName ?? "—"}</td>
                  ) : null}
                  <td className="meta">{release.environment ?? "—"}</td>
                  <td>
                    <span className={`badge badge-${statusToBadge(release.status)}`}>
                      {release.status}
                    </span>
                  </td>
                  <td>
                    {release.newIssueCount > 0 ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          color: "var(--level-warning)",
                        }}
                      >
                        <Warning size={14} weight="bold" />
                        {release.newIssueCount}
                      </span>
                    ) : (
                      <span className="meta">0</span>
                    )}
                  </td>
                  <td className="meta">{formatDate(release.dateReleased)}</td>
                  <td className="meta">{relativeTime(release.createdAt)}</td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        justifyContent: "flex-end",
                      }}
                    >
                      <Link
                        href={link}
                        className="meta"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          textDecoration: "none",
                        }}
                      >
                        View <ArrowRight size={12} weight="bold" />
                      </Link>
                      {projectId ? (
                        <button
                          type="button"
                          className="meta"
                          onClick={() => handleDelete(release)}
                          disabled={deletingId === release.id}
                          aria-label={`Delete ${release.version}`}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            color: "var(--text-muted)",
                          }}
                        >
                          <Trash size={14} weight="bold" />
                          {deletingId === release.id ? "Deleting..." : "Delete"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
