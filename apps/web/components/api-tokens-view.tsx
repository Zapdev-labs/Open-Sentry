"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Key, Trash } from "@phosphor-icons/react";
import type { ListedApiToken } from "@/lib/queries-tokens";

type Scope = "read" | "write" | "admin";

interface ApiTokensViewProps {
  initialTokens: ListedApiToken[];
}

export function ApiTokensView({ initialTokens }: ApiTokensViewProps) {
  const router = useRouter();
  const [tokens, setTokens] = useState(initialTokens);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<Scope>("read");
  const [expiry, setExpiry] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setCreateError(null);
    setPlaintext(null);

    const res = await fetch("/api/settings/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        scope,
        expiresAt: expiry ? new Date(expiry).toISOString() : null,
      }),
    });
    const data = (await res.json()) as { token?: ListedApiToken; plaintext?: string; error?: string };
    if (!res.ok || !data.token || !data.plaintext) {
      setCreateError(data.error ?? "Failed to create token");
      setCreating(false);
      return;
    }
    setTokens((cur) => [data.token!, ...cur]);
    setPlaintext(data.plaintext);
    setName("");
    setExpiry("");
    setScope("read");
    setCreating(false);
    router.refresh();
  }

  async function handleRevoke(id: string) {
    if (!window.confirm("Revoke this token? Apps using it will lose access immediately.")) return;
    setRevokingId(id);
    const res = await fetch(`/api/settings/tokens/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTokens((cur) => cur.filter((t) => t.id !== id));
      router.refresh();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(data.error ?? "Failed to revoke");
    }
    setRevokingId(null);
  }

  function copyPlaintext() {
    if (!plaintext) return;
    void navigator.clipboard.writeText(plaintext).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <>
      {plaintext ? (
        <div
          className="card fade-in"
          style={{
            marginBottom: 24,
            borderColor: "var(--cta)",
            background: "var(--dash-accent-muted)",
          }}
        >
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>Copy your new token now</h3>
          <p className="meta" style={{ marginBottom: 12 }}>
            This is the only time we'll show the full token. Store it somewhere safe.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <code
              style={{
                flex: 1,
                padding: "10px 12px",
                background: "var(--dash-bg)",
                border: "1px solid var(--dash-border)",
                borderRadius: 6,
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                overflow: "auto",
              }}
            >
              {plaintext}
            </code>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={copyPlaintext}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {copied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            type="button"
            className="meta"
            onClick={() => setPlaintext(null)}
            style={{ marginTop: 12, background: "none", border: "none", cursor: "pointer" }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="card fade-in" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>Create token</h2>
        <form onSubmit={handleCreate}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 2fr) minmax(140px, 1fr) minmax(180px, 1fr) auto",
              gap: 12,
              alignItems: "flex-end",
            }}
          >
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="token-name">Name</label>
              <input
                id="token-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. CI deploy script"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="token-scope">Scope</label>
              <select
                id="token-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value as Scope)}
              >
                <option value="read">Read</option>
                <option value="write">Write</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="token-expiry">Expires (optional)</label>
              <input
                id="token-expiry"
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
              />
            </div>

            <button type="submit" className="btn" disabled={creating || !name.trim()}>
              {creating ? "Creating..." : "Create token"}
            </button>
          </div>

          {createError ? (
            <p style={{ color: "var(--level-error)", marginTop: 12, fontSize: 14 }}>
              {createError}
            </p>
          ) : null}
        </form>
      </div>

      <div className="card fade-in">
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>Active tokens</h2>
        {tokens.length === 0 ? (
          <p className="meta">No tokens yet. Create one above to get started.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table-editorial">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Token</th>
                  <th>Scope</th>
                  <th>Last used</th>
                  <th>Expires</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => {
                  const revoked = t.revokedAt !== null;
                  return (
                    <tr key={t.id} style={revoked ? { opacity: 0.5 } : undefined}>
                      <td style={{ fontWeight: 500 }}>
                        <Key size={14} weight="bold" style={{ marginRight: 8, verticalAlign: -2 }} />
                        {t.name}
                      </td>
                      <td className="meta" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                        ••••••••••••{t.lastFour}
                      </td>
                      <td>
                        <span className={`badge badge-level-${scopeToBadge(t.scope)}`}>
                          {t.scope}
                        </span>
                      </td>
                      <td className="meta">
                        {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString() : "Never"}
                      </td>
                      <td className="meta">
                        {t.expiresAt ? new Date(t.expiresAt).toLocaleDateString() : "Never"}
                      </td>
                      <td className="meta">{new Date(t.createdAt).toLocaleDateString()}</td>
                      <td>
                        {revoked ? (
                          <span className="badge badge-resolved">revoked</span>
                        ) : (
                          <button
                            type="button"
                            className="meta"
                            onClick={() => handleRevoke(t.id)}
                            disabled={revokingId === t.id}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                            aria-label={`Revoke ${t.name}`}
                          >
                            <Trash size={14} weight="bold" />
                            {revokingId === t.id ? "Revoking..." : "Revoke"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function scopeToBadge(scope: Scope): "info" | "warning" | "error" {
  if (scope === "admin") return "error";
  if (scope === "write") return "warning";
  return "info";
}
