"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "@phosphor-icons/react";

export type ReleaseRow = {
  id: string;
  version: string;
  ref: string | null;
  environment: string | null;
  status: "open" | "shipped" | "archived";
  newIssueCount: number;
  createdAt: Date | string;
  dateReleased: Date | string | null;
  projectName?: string;
  projectId?: string;
};

interface CreateReleaseFormProps {
  projectId: string;
  onCreated?: (version: string) => void;
  compact?: boolean;
}

export function CreateReleaseForm({ projectId, onCreated, compact }: CreateReleaseFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState("");
  const [ref, setRef] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!version.trim()) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/projects/${projectId}/releases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: version.trim(),
        ref: ref.trim() || undefined,
        environment: environment.trim() || undefined,
        url: url.trim() || undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Failed to create release");
      setSubmitting(false);
      return;
    }

    setVersion("");
    setRef("");
    setUrl("");
    setEnvironment("production");
    setSubmitting(false);
    setOpen(false);
    onCreated?.(version.trim());
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn"
        onClick={() => setOpen(true)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <Plus size={14} weight="bold" />
        New release
      </button>
    );
  }

  return (
    <div
      className="card fade-in"
      style={{ marginBottom: 24, ...(compact ? { padding: 16 } : {}) }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h3 style={{ fontSize: 16, margin: 0 }}>New release</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
          }}
        >
          <X size={16} weight="bold" />
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(180px, 2fr) minmax(140px, 1fr) minmax(140px, 1fr) minmax(200px, 1fr) auto",
            gap: 12,
            alignItems: "flex-end",
          }}
        >
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="release-version">Version</label>
            <input
              id="release-version"
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g. 1.4.2 or 2024.05.01-a1b2c3"
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="release-ref">Git ref (optional)</label>
            <input
              id="release-ref"
              type="text"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="main"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="release-env">Environment</label>
            <input
              id="release-env"
              type="text"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              placeholder="production"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="release-url">URL (optional)</label>
            <input
              id="release-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/..."
            />
          </div>
          <button type="submit" className="btn" disabled={submitting || !version.trim()}>
            {submitting ? "Creating..." : "Create"}
          </button>
        </div>
        {error ? (
          <p style={{ color: "var(--level-error)", marginTop: 12, fontSize: 14 }}>{error}</p>
        ) : null}
      </form>
    </div>
  );
}
