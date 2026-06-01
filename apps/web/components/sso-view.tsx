"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash, X } from "@phosphor-icons/react";

export type SsoConnectionRow = {
  id: string;
  providerType: "saml" | "oidc";
  providerName: string;
  emailDomains: string[];
  metadata: Record<string, unknown>;
  enabled: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

interface SsoViewProps {
  initialConnections: SsoConnectionRow[];
}

export function SsoView({ initialConnections }: SsoViewProps) {
  const router = useRouter();
  const [connections, setConnections] = useState(initialConnections);
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [providerType, setProviderType] = useState<"saml" | "oidc">("saml");
  const [providerName, setProviderName] = useState("");
  const [domainsText, setDomainsText] = useState("");
  const [metadataText, setMetadataText] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  function startCreate() {
    setProviderType("saml");
    setProviderName("");
    setDomainsText("");
    setMetadataText("");
    setEnabled(true);
    setError(null);
    setEditing(true);
  }

  function parseMetadata(text: string): Record<string, unknown> {
    const trimmed = text.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through
    }
    // Treat as a URL/string metadata reference
    return { url: trimmed };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const domains = domainsText
      .split(/[\s,]+/)
      .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
      .filter(Boolean);
    if (!providerName.trim()) {
      setError("Provider name is required");
      setSaving(false);
      return;
    }
    if (domains.length === 0) {
      setError("At least one email domain is required");
      setSaving(false);
      return;
    }
    const metadata = parseMetadata(metadataText);

    const res = await fetch("/api/sso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerType,
        providerName: providerName.trim(),
        emailDomains: domains,
        metadata,
        enabled,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Failed to create SSO connection");
      setSaving(false);
      return;
    }
    setEditing(false);
    setSaving(false);
    startTransition(() => router.refresh());
  }

  async function handleDisable(id: string, name: string) {
    if (
      !window.confirm(
        `Disable SSO for "${name}"? Members with matching email domains will no longer be routed through this provider.`
      )
    )
      return;
    setRemovingId(id);
    const res = await fetch(`/api/sso/${id}`, { method: "DELETE" });
    if (res.ok) {
      setConnections((cur) =>
        cur.map((c) => (c.id === id ? { ...c, enabled: false } : c))
      );
      startTransition(() => router.refresh());
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(data.error ?? "Failed to disable");
    }
    setRemovingId(null);
  }

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
            <h2 style={{ fontSize: 20, margin: 0 }}>SSO connections</h2>
            <p className="meta" style={{ marginTop: 4 }}>
              Each connection maps one or more email domains to an identity provider.
            </p>
          </div>
          {!editing ? (
            <button type="button" className="btn" onClick={startCreate}>
              + New connection
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
              <h3 style={{ fontSize: 16, margin: 0 }}>New SSO connection</h3>
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
                gridTemplateColumns: "minmax(200px, 1fr) minmax(200px, 2fr)",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="sso-type">Provider type</label>
                <select
                  id="sso-type"
                  value={providerType}
                  onChange={(e) => setProviderType(e.target.value as "saml" | "oidc")}
                >
                  <option value="saml">SAML 2.0</option>
                  <option value="oidc">OpenID Connect</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="sso-name">Provider name</label>
                <input
                  id="sso-name"
                  type="text"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  placeholder="Okta, Azure AD, Google Workspace…"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="sso-domains">Email domains (comma- or space-separated)</label>
              <input
                id="sso-domains"
                type="text"
                value={domainsText}
                onChange={(e) => setDomainsText(e.target.value)}
                placeholder="example.com, subsidiary.com"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="sso-metadata">
                {providerType === "saml" ? "IdP metadata URL or XML" : "OIDC discovery URL or JSON"}
              </label>
              <textarea
                id="sso-metadata"
                value={metadataText}
                onChange={(e) => setMetadataText(e.target.value)}
                placeholder="https://idp.example.com/saml/metadata  (or paste JSON)"
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid var(--dash-border)",
                  borderRadius: 6,
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  resize: "vertical",
                }}
              />
            </div>
            <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                id="sso-enabled"
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <label htmlFor="sso-enabled" style={{ margin: 0, cursor: "pointer" }}>
                Enabled immediately
              </label>
            </div>
            {error ? (
              <p style={{ color: "var(--level-error)", marginTop: 12, fontSize: 14 }}>{error}</p>
            ) : null}
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? "Saving..." : "Create connection"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {connections.length === 0 ? (
          <p className="meta">
            No SSO connections yet. Create one above to start routing members through your
            identity provider.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table-editorial">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Type</th>
                  <th>Domains</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {connections.map((conn) => (
                  <tr key={conn.id} style={conn.enabled ? undefined : { opacity: 0.5 }}>
                    <td style={{ fontWeight: 500 }}>{conn.providerName}</td>
                    <td>
                      <span className="badge badge-info">
                        {conn.providerType.toUpperCase()}
                      </span>
                    </td>
                    <td className="meta" style={{ fontSize: 12 }}>
                      {conn.emailDomains.map((d) => `@${d}`).join(", ")}
                    </td>
                    <td>
                      <span
                        className={`badge ${conn.enabled ? "badge-resolved" : "badge-info"}`}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        {conn.enabled ? <Check size={12} weight="bold" /> : null}
                        {conn.enabled ? "enabled" : "disabled"}
                      </span>
                    </td>
                    <td className="meta">
                      {new Date(conn.updatedAt).toLocaleDateString()}
                    </td>
                    <td>
                      {conn.enabled ? (
                        <button
                          type="button"
                          className="meta"
                          onClick={() => handleDisable(conn.id, conn.providerName)}
                          disabled={removingId === conn.id}
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
                          {removingId === conn.id ? "Disabling..." : "Disable"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card fade-in">
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>How SSO works here</h2>
        <p className="meta" style={{ marginBottom: 12 }}>
          We support SAML 2.0 and OpenID Connect. Provide the IdP metadata or discovery URL; we
          handle the assertion exchange and member provisioning on the first successful sign-in.
        </p>
        <ul className="meta" style={{ paddingLeft: 20, lineHeight: 1.8 }}>
          <li>
            Members whose email matches a configured domain are redirected to the IdP on sign-in.
          </li>
          <li>
            First-time SSO users are automatically added to the organization as members.
          </li>
          <li>
            Disabling a connection stops new SSO logins but does not remove existing members.
          </li>
          <li>
            For automated user provisioning, configure SCIM in the <strong>SCIM provisioning</strong> tab.
          </li>
        </ul>
      </div>
    </>
  );
}
