"use client";

import { useState } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react";

interface LinearIntegrationFormProps {
  projectId: string;
  initialEnabled: boolean;
  initialTeamId: string;
  initialHasApiKey: boolean;
}

export function LinearIntegrationForm({
  projectId,
  initialEnabled,
  initialTeamId,
  initialHasApiKey,
}: LinearIntegrationFormProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [teamId, setTeamId] = useState(initialTeamId);
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(initialHasApiKey);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const res = await fetch(`/api/projects/${projectId}/integrations/linear`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled,
        teamId: teamId.trim(),
        apiKey: apiKey.trim() || undefined,
      }),
    });

    const data = (await res.json()) as {
      error?: string;
      config?: { hasApiKey: boolean };
    };

    if (!res.ok) {
      setError(data.error ?? "Failed to save");
      setLoading(false);
      return;
    }

    if (data.config?.hasApiKey) {
      setHasApiKey(true);
      setApiKey("");
    }

    setMessage("Linear integration saved");
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span style={{ fontSize: 15 }}>Create Linear issues for new errors</span>
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="linear-team-id">Linear team ID</label>
        <input
          id="linear-team-id"
          type="text"
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          placeholder="e.g. a1b2c3d4-..."
          required
        />
        <p className="meta" style={{ marginTop: 6 }}>
          Find this in Linear → Team settings → copy the team UUID from the URL or API.
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="linear-api-key">Linear API key</label>
        <input
          id="linear-api-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={hasApiKey ? "Saved — enter a new key to replace" : "lin_api_..."}
          autoComplete="off"
        />
      </div>

      {error ? (
        <p style={{ color: "var(--level-error)", marginBottom: 12, fontSize: 14 }}>{error}</p>
      ) : null}
      {message ? (
        <p style={{ color: "var(--text-muted)", marginBottom: 12, fontSize: 14 }}>{message}</p>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Saving..." : "Save integration"}
        </button>
        <a
          href="https://linear.app/settings/api"
          target="_blank"
          rel="noopener noreferrer"
          className="meta"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          Get API key
          <ArrowSquareOut size={14} weight="bold" />
        </a>
      </div>
    </form>
  );
}
