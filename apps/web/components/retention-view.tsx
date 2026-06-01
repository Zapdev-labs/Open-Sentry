"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash, X } from "@phosphor-icons/react";

export type RetentionPolicyRow = {
  id: string;
  projectId: string | null;
  projectName: string | null;
  dataType: "events" | "transactions" | "spans" | "ai_generations" | "uptime_checks" | "all";
  retentionDays: number;
  enabled: boolean;
  lastPrunedAt: Date | string | null;
  updatedAt: Date | string;
};

export type ProjectOption = {
  id: string;
  name: string;
};

interface RetentionViewProps {
  initialPolicies: RetentionPolicyRow[];
  projects: ProjectOption[];
}

const DATA_TYPE_LABEL: Record<RetentionPolicyRow["dataType"], string> = {
  events: "Error events",
  transactions: "Performance transactions",
  spans: "Spans (inherits transactions)",
  ai_generations: "AI generation logs",
  uptime_checks: "Uptime probe results",
  all: "All data (catch-all)",
};

function formatRelative(date: Date | string | null): string {
  if (!date) return "Never";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RetentionView({ initialPolicies, projects }: RetentionViewProps) {
  const router = useRouter();
  const [policies, setPolicies] = useState(initialPolicies);
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [scope, setScope] = useState<"org" | string>("org");
  const [dataType, setDataType] = useState<RetentionPolicyRow["dataType"]>("all");
  const [retentionDays, setRetentionDays] = useState<number>(90);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function startEdit(policy?: RetentionPolicyRow) {
    if (policy) {
      setScope(policy.projectId ?? "org");
      setDataType(policy.dataType);
      setRetentionDays(policy.retentionDays);
      setEnabled(policy.enabled);
    } else {
      setScope("org");
      setDataType("all");
      setRetentionDays(90);
      setEnabled(true);
    }
    setError(null);
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const projectId = scope === "org" ? null : scope;
    const res = await fetch("/api/settings/retention", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        dataType,
        retentionDays,
        enabled,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Failed to save");
      setSaving(false);
      return;
    }
    setEditing(false);
    setSaving(false);
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this retention policy? Data older than the cutoff will no longer be auto-pruned by it.")) return;
    setDeletingId(id);
    const res = await fetch(`/api/settings/retention?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setPolicies((cur) => cur.filter((p) => p.id !== id));
      startTransition(() => router.refresh());
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(data.error ?? "Failed to delete");
    }
    setDeletingId(null);
  }

  const orgDefaults = policies.filter((p) => !p.projectId);
  const projectPolicies = policies.filter((p) => p.projectId);

  return (
    <>
      <div className="card fade-in" style={{ marginBottom: 24 }}>
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
          <div>
            <h2 style={{ fontSize: 20, margin: 0 }}>Retention policies</h2>
            <p className="meta" style={{ marginTop: 4 }}>
              Org defaults apply to every project. Project-specific policies override the
              default for that data type.
            </p>
          </div>
          {!editing ? (
            <button
              type="button"
              className="btn"
              onClick={() => startEdit()}
            >
              + New policy
            </button>
          ) : null}
        </div>

        {editing ? (
          <form
            onSubmit={handleSave}
            style={{
              padding: 16,
              border: "1px solid var(--dash-border)",
              borderRadius: 8,
              background: "var(--dash-bg-soft)",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <h3 style={{ fontSize: 16, margin: 0 }}>Policy</h3>
              <button
                type="button"
                onClick={() => setEditing(false)}
                aria-label="Close"
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={16} weight="bold" />
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(200px, 1fr) minmax(200px, 1fr) minmax(140px, 140px) auto",
                gap: 12,
                alignItems: "flex-end",
              }}
            >
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="scope">Scope</label>
                <select
                  id="scope"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as "org" | string)}
                >
                  <option value="org">Organization default</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      Project: {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="dataType">Data type</label>
                <select
                  id="dataType"
                  value={dataType}
                  onChange={(e) => setDataType(e.target.value as RetentionPolicyRow["dataType"])}
                >
                  {Object.entries(DATA_TYPE_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="days">Retention (days)</label>
                <input
                  id="days"
                  type="number"
                  min={1}
                  max={3650}
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Number(e.target.value) || 1)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label
                  htmlFor="enabled"
                  style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                >
                  <input
                    id="enabled"
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  Enabled
                </label>
              </div>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
            {error ? (
              <p style={{ color: "var(--level-error)", marginTop: 12, fontSize: 14 }}>{error}</p>
            ) : null}
          </form>
        ) : null}

        {policies.length === 0 ? (
          <p className="meta">
            No retention policies yet. By default, data is kept indefinitely. Add a policy to
            auto-prune old events, transactions, AI logs, or uptime checks.
          </p>
        ) : (
          <>
            {orgDefaults.length > 0 ? (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, marginBottom: 8, color: "var(--text-muted)" }}>
                  Organization defaults
                </h3>
                <PolicyTable
                  policies={orgDefaults}
                  deletingId={deletingId}
                  onEdit={startEdit}
                  onDelete={handleDelete}
                />
              </div>
            ) : null}
            {projectPolicies.length > 0 ? (
              <div>
                <h3 style={{ fontSize: 14, marginBottom: 8, color: "var(--text-muted)" }}>
                  Project-specific overrides
                </h3>
                <PolicyTable
                  policies={projectPolicies}
                  deletingId={deletingId}
                  onEdit={startEdit}
                  onDelete={handleDelete}
                  showProject
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="card fade-in">
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>How retention works</h2>
        <p className="meta" style={{ marginBottom: 12 }}>
          The retention worker runs hourly. For each enabled policy, it deletes rows older than
          the cutoff. Project-specific policies override the org default for that data type.
        </p>
        <ul className="meta" style={{ paddingLeft: 20, lineHeight: 1.8 }}>
          <li>
            <strong>Spans</strong> are pruned automatically when their parent transaction is
            deleted — set a transactions policy to control them.
          </li>
          <li>
            <strong>Org default &quot;all&quot;</strong> applies to every data type unless a
            more specific policy exists.
          </li>
          <li>
            Pruning is irreversible. Events older than the retention window are permanently
            deleted.
          </li>
        </ul>
      </div>
    </>
  );
}

interface PolicyTableProps {
  policies: RetentionPolicyRow[];
  deletingId: string | null;
  showProject?: boolean;
  onEdit: (policy: RetentionPolicyRow) => void;
  onDelete: (id: string) => void;
}

function PolicyTable({ policies, deletingId, showProject, onEdit, onDelete }: PolicyTableProps) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="table-editorial">
        <thead>
          <tr>
            <th>Data type</th>
            {showProject ? <th>Project</th> : null}
            <th>Retention</th>
            <th>Status</th>
            <th>Last pruned</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {policies.map((policy) => (
            <tr key={policy.id}>
              <td style={{ fontWeight: 500 }}>{DATA_TYPE_LABEL[policy.dataType]}</td>
              {showProject ? <td className="meta">{policy.projectName ?? "—"}</td> : null}
              <td>{policy.retentionDays} days</td>
              <td>
                <span
                  className={`badge ${policy.enabled ? "badge-resolved" : "badge-info"}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  {policy.enabled ? (
                    <Check size={12} weight="bold" />
                  ) : null}
                  {policy.enabled ? "enabled" : "disabled"}
                </span>
              </td>
              <td className="meta">{formatRelative(policy.lastPrunedAt)}</td>
              <td>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    type="button"
                    className="meta"
                    onClick={() => onEdit(policy)}
                    style={{ background: "none", border: "none", cursor: "pointer" }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="meta"
                    onClick={() => onDelete(policy.id)}
                    disabled={deletingId === policy.id}
                    aria-label="Delete policy"
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
                    {deletingId === policy.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
