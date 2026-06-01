"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash } from "@phosphor-icons/react";

export function CreateMonitorForm({ projectId }: { projectId: string }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const [expectedStatus, setExpectedStatus] = useState(200);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch(`/api/projects/${projectId}/uptime`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), url: url.trim(), intervalSeconds, expectedStatus }),
    });

    if (res.ok) {
      setName("");
      setUrl("");
      router.refresh();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Failed to create monitor");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="uptime-form">
      <div className="uptime-form-row">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="monitor-name">Name</label>
          <input
            id="monitor-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Marketing site"
            required
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0, flex: 2 }}>
          <label htmlFor="monitor-url">URL</label>
          <input
            id="monitor-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/health"
            required
          />
        </div>
      </div>
      <div className="uptime-form-row">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="monitor-interval">Interval</label>
          <select
            id="monitor-interval"
            className="filter-select"
            value={intervalSeconds}
            onChange={(e) => setIntervalSeconds(Number(e.target.value))}
          >
            <option value={30}>Every 30s</option>
            <option value={60}>Every 1m</option>
            <option value={300}>Every 5m</option>
            <option value={900}>Every 15m</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="monitor-status">Expected status</label>
          <input
            id="monitor-status"
            type="number"
            value={expectedStatus}
            onChange={(e) => setExpectedStatus(Number(e.target.value))}
            min={100}
            max={599}
          />
        </div>
        <button type="submit" className="btn" disabled={loading} style={{ alignSelf: "flex-end" }}>
          {loading ? "Adding..." : "Add monitor"}
        </button>
      </div>
      {error && <p className="auth-error" style={{ margin: 0 }}>{error}</p>}
    </form>
  );
}

export function DeleteMonitorButton({
  projectId,
  monitorId,
}: {
  projectId: string;
  monitorId: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this monitor and its history?")) return;
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/uptime/${monitorId}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="uptime-delete-btn"
      onClick={handleDelete}
      disabled={loading}
      aria-label="Delete monitor"
      title="Delete monitor"
    >
      <Trash size={16} weight="bold" />
    </button>
  );
}
