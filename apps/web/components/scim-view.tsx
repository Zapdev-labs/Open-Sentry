"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Trash, Key } from "@phosphor-icons/react";

export type ScimTokenRow = {
  id: string;
  label: string;
  lastFour: string;
  status: "active" | "revoked";
  createdBy: string;
  lastUsedAt: Date | string | null;
  revokedAt: Date | string | null;
  createdAt: Date | string;
};

interface ScimViewProps {
  initialTokens: ScimTokenRow[];
}

export function ScimView({ initialTokens }: ScimViewProps) {
  const router = useRouter();
  const [tokens, setTokens] = useState(initialTokens);
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setCreating(true);
    setError(null);
    setPlaintext(null);

    const res = await fetch("/api/scim/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim() }),
    });
    const data = (await res.json()) as {
      token?: ScimTokenRow;
      plaintext?: string;
      error?: string;
    };
    if (!res.ok || !data.token || !data.plaintext) {
      setError(data.error ?? "Failed to create token");
      setCreating(false);
      return;
    }
    setTokens((cur) => [data.token!, ...cur]);
    setPlaintext(data.plaintext);
    setLabel("");
    setCreating(false);
    router.refresh();
  }

  async function handleRevoke(id: string) {
    if (
      !window.confirm(
        "Revoke this SCIM token? The identity provider using it will lose provisioning access immediately."
      )
    )
      return;
    setRevokingId(id);
    const res = await fetch(`/api/scim/tokens/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTokens((cur) =>
        cur.map((t) => (t.id === id ? { ...t, status: "revoked", revokedAt: new Date() } : t))
      );
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
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>Copy your SCIM token now</h3>
          <p className="meta" style={{ marginBottom: 12 }}>
            This is the only time we&apos;ll show the full token. Configure it as the bearer
            token in your identity provider&apos;s SCIM integration.
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
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>Create SCIM token</h2>
        <form onSubmit={handleCreate}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 1fr) auto",
              gap: 12,
              alignItems: "flex-end",
            }}
          >
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="scim-label">Label</label>
              <input
                id="scim-label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Okta production"
                required
              />
            </div>
            <button type="submit" className="btn" disabled={creating || !label.trim()}>
              {creating ? "Creating..." : "Create token"}
            </button>
          </div>
          {error ? (
            <p style={{ color: "var(--level-error)", marginTop: 12, fontSize: 14 }}>{error}</p>
          ) : null}
        </form>
      </div>

      <div className="card fade-in" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>Active tokens</h2>
        {tokens.length === 0 ? (
          <p className="meta">No SCIM tokens yet. Create one above to start provisioning.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table-editorial">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Token</th>
                  <th>Status</th>
                  <th>Last used</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => {
                  const revoked = t.status === "revoked";
                  return (
                    <tr key={t.id} style={revoked ? { opacity: 0.5 } : undefined}>
                      <td style={{ fontWeight: 500 }}>
                        <Key size={14} weight="bold" style={{ marginRight: 8, verticalAlign: -2 }} />
                        {t.label}
                      </td>
                      <td className="meta" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                        scim_••••••••••••{t.lastFour}
                      </td>
                      <td>
                        <span
                          className={`badge ${revoked ? "badge-info" : "badge-resolved"}`}
                        >
                          {revoked ? "revoked" : "active"}
                        </span>
                      </td>
                      <td className="meta">
                        {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : "Never"}
                      </td>
                      <td className="meta">{new Date(t.createdAt).toLocaleDateString()}</td>
                      <td>
                        {revoked ? null : (
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
                              color: "var(--text-muted)",
                            }}
                            aria-label={`Revoke ${t.label}`}
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

      <div className="card fade-in">
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>SCIM v2 endpoints</h2>
        <p className="meta" style={{ marginBottom: 12 }}>
          Configure these endpoints in your identity provider. Use the SCIM token as the bearer
          credential.
        </p>
        <div style={{ display: "grid", gap: 8, fontFamily: "var(--font-mono)", fontSize: 13 }}>
          <div>
            <span className="meta">Users&nbsp;·&nbsp;</span>
            <code>GET/POST /api/scim/v2/Users</code>
          </div>
          <div>
            <span className="meta">User&nbsp;·&nbsp;</span>
            <code>GET/PATCH/DELETE /api/scim/v2/Users/&#123;id&#125;</code>
          </div>
          <div>
            <span className="meta">Groups&nbsp;·&nbsp;</span>
            <code>GET /api/scim/v2/Groups</code>
          </div>
          <div>
            <span className="meta">Service provider config&nbsp;·&nbsp;</span>
            <code>GET /api/scim/v2/ServiceProviderConfig</code>
          </div>
        </div>
        <p className="meta" style={{ marginTop: 12 }}>
          Authentication: <code>Authorization: Bearer scim_…</code>
        </p>
      </div>
    </>
  );
}
