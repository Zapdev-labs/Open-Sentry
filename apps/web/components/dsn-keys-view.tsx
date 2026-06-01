"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Plus, Trash } from "@phosphor-icons/react";
import type { ListedDsnKey } from "@/lib/queries-tokens";

interface DsnKeysViewProps {
  projectId: string;
  initialKeys: ListedDsnKey[];
  legacyPublicKey: string;
}

type Environment = ListedDsnKey["environment"];

export function DsnKeysView({ projectId, initialKeys, legacyPublicKey }: DsnKeysViewProps) {
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [environment, setEnvironment] = useState<Environment>("staging");
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newDsn, setNewDsn] = useState<{ publicKey: string; dsn: string; env: Environment } | null>(
    null
  );
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/dsn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ environment, label: label.trim() || undefined }),
    });
    const data = (await res.json()) as {
      key?: ListedDsnKey;
      publicKey?: string;
      dsn?: string;
      error?: string;
    };
    if (!res.ok || !data.key || !data.publicKey || !data.dsn) {
      setError(data.error ?? "Failed to create DSN");
      setCreating(false);
      return;
    }
    setKeys((cur) => [data.key!, ...cur]);
    setNewDsn({ publicKey: data.publicKey, dsn: data.dsn, env: environment });
    setLabel("");
    setCreating(false);
    router.refresh();
  }

  async function handleRevoke(keyId: string) {
    if (!window.confirm("Revoke this DSN key? Apps using it will stop sending events immediately."))
      return;
    setRevokingId(keyId);
    const res = await fetch(`/api/projects/${projectId}/dsn/${keyId}`, { method: "DELETE" });
    if (res.ok) {
      setKeys((cur) =>
        cur.map((k) => (k.id === keyId ? { ...k, revokedAt: new Date() } : k))
      );
      router.refresh();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(data.error ?? "Failed to revoke");
    }
    setRevokingId(null);
  }

  function copy(value: string) {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <>
      {newDsn ? (
        <div
          className="card fade-in"
          style={{
            marginBottom: 16,
            borderColor: "var(--cta)",
            background: "var(--dash-accent-muted)",
          }}
        >
          <h4 style={{ fontSize: 15, marginBottom: 8 }}>
            New {newDsn.env} DSN — copy now
          </h4>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <code style={dsnCodeStyle}>{newDsn.dsn}</code>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => copy(newDsn.dsn)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {copied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            type="button"
            className="meta"
            onClick={() => setNewDsn(null)}
            style={{ background: "none", border: "none", cursor: "pointer" }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <form
        onSubmit={handleCreate}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(140px, 1fr) minmax(200px, 2fr) auto",
          gap: 12,
          alignItems: "flex-end",
          marginBottom: 16,
        }}
      >
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="dsn-env">Environment</label>
          <select
            id="dsn-env"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as Environment)}
          >
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
            <option value="test">Test</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="dsn-label">Label (optional)</label>
          <input
            id="dsn-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Mobile app"
          />
        </div>
        <button
          type="submit"
          className="btn"
          disabled={creating}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={14} weight="bold" />
          {creating ? "Creating..." : "Add DSN key"}
        </button>
      </form>

      {error ? (
        <p style={{ color: "var(--level-error)", marginBottom: 12, fontSize: 14 }}>{error}</p>
      ) : null}

      {keys.length === 0 ? (
        <p className="meta">No per-environment DSNs yet. Use the form above to add one.</p>
      ) : (
        <table className="table-editorial">
          <thead>
            <tr>
              <th>Environment</th>
              <th>Label</th>
              <th>Public key</th>
              <th>Last used</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr style={{ opacity: 0.7 }}>
              <td>
                <span className="badge badge-level-info">legacy</span>
              </td>
              <td className="meta">Default (created with project)</td>
              <td className="meta" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                {legacyPublicKey.slice(0, 12)}…{legacyPublicKey.slice(-4)}
              </td>
              <td className="meta">—</td>
              <td className="meta">—</td>
              <td className="meta">—</td>
            </tr>
            {keys.map((k) => {
              const revoked = k.revokedAt !== null;
              return (
                <tr key={k.id} style={revoked ? { opacity: 0.5 } : undefined}>
                  <td>
                    <span className={`badge badge-level-${envToBadge(k.environment)}`}>
                      {k.environment}
                    </span>
                  </td>
                  <td className="meta">{k.label ?? "—"}</td>
                  <td className="meta" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                    {k.publicKey.slice(0, 12)}…{k.publicKey.slice(-4)}
                  </td>
                  <td className="meta">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}
                  </td>
                  <td className="meta">{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td>
                    {revoked ? (
                      <span className="badge badge-resolved">revoked</span>
                    ) : (
                      <button
                        type="button"
                        className="meta"
                        onClick={() => handleRevoke(k.id)}
                        disabled={revokingId === k.id}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Trash size={14} weight="bold" />
                        {revokingId === k.id ? "Revoking..." : "Revoke"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

const dsnCodeStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 10px",
  background: "var(--dash-bg)",
  border: "1px solid var(--dash-border)",
  borderRadius: 6,
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  overflow: "auto",
  whiteSpace: "nowrap",
};

function envToBadge(env: Environment): "info" | "warning" | "error" {
  if (env === "production") return "error";
  if (env === "staging") return "warning";
  return "info";
}
