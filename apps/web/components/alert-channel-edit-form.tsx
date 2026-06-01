"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AlertChannelConfig } from "@sentry-clone/db";

const CHANNEL_TYPES = [
  { value: "slack", label: "Slack" },
  { value: "discord", label: "Discord" },
  { value: "msteams", label: "Microsoft Teams" },
  { value: "webhook", label: "Generic webhook" },
  { value: "pagerduty", label: "PagerDuty" },
  { value: "email", label: "Email" },
] as const;

function getChannelUrl(config: AlertChannelConfig): string {
  if (config.kind === "webhook") return config.url ?? "";
  if (
    config.kind === "slack" ||
    config.kind === "discord" ||
    config.kind === "msteams"
  ) {
    return config.webhookUrl ?? "";
  }
  return "";
}

interface AlertChannelFormProps {
  channel: {
    id: string;
    name: string;
    channelType: string;
    enabled: boolean;
    config: AlertChannelConfig;
  };
}

export function AlertChannelForm({ channel }: AlertChannelFormProps) {
  const router = useRouter();
  const [name, setName] = useState(channel.name);
  const [enabled, setEnabled] = useState(channel.enabled);
  const [config, setConfig] = useState<AlertChannelConfig>(channel.config);
  const [recipientsText, setRecipientsText] = useState(
    config.kind === "email" ? config.recipients.join(", ") : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patchConfig(patch: Partial<AlertChannelConfig>) {
    setConfig((cur) => ({ ...cur, ...patch }) as AlertChannelConfig);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    let nextConfig: AlertChannelConfig = config;
    if (config.kind === "email") {
      const recipients = recipientsText
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (recipients.length === 0) {
        setError("At least one recipient is required");
        setSaving(false);
        return;
      }
      nextConfig = { kind: "email", recipients };
    }

    const res = await fetch(`/api/alerts/channels/${channel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        enabled,
        config: nextConfig,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Failed to save");
      setSaving(false);
      return;
    }
    setSaving(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(240px, 1fr) minmax(200px, 1fr)",
          gap: 12,
        }}
      >
        <div className="form-group">
          <label htmlFor="channel-name">Name</label>
          <input
            id="channel-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="channel-type">Type</label>
          <input
            id="channel-type"
            type="text"
            value={CHANNEL_TYPES.find((c) => c.value === channel.channelType)?.label ?? channel.channelType}
            disabled
          />
        </div>
      </div>

      {(config.kind === "slack" ||
        config.kind === "discord" ||
        config.kind === "msteams" ||
        config.kind === "webhook") && (
        <div className="form-group">
          <label htmlFor="webhook-url">
            {config.kind === "webhook" ? "Endpoint URL" : "Webhook URL"}
          </label>
          <input
            id="webhook-url"
            type="url"
            value={getChannelUrl(config)}
            onChange={(e) => {
              if (config.kind === "webhook") {
                patchConfig({ url: e.target.value });
              } else {
                patchConfig({ webhookUrl: e.target.value });
              }
            }}
          />
        </div>
      )}

      {config.kind === "webhook" ? (
        <div className="form-group">
          <label htmlFor="webhook-secret">Signing secret (optional)</label>
          <input
            id="webhook-secret"
            type="text"
            value={config.secret ?? ""}
            onChange={(e) => patchConfig({ secret: e.target.value || undefined })}
            placeholder="HMAC-SHA256 over the request body"
          />
        </div>
      ) : null}

      {config.kind === "pagerduty" ? (
        <div className="form-group">
          <label htmlFor="pagerduty-key">PagerDuty integration key</label>
          <input
            id="pagerduty-key"
            type="text"
            value={config.integrationKey}
            onChange={(e) => patchConfig({ integrationKey: e.target.value })}
          />
        </div>
      ) : null}

      {config.kind === "email" ? (
        <div className="form-group">
          <label htmlFor="email-recipients">Recipients</label>
          <input
            id="email-recipients"
            type="text"
            value={recipientsText}
            onChange={(e) => setRecipientsText(e.target.value)}
            placeholder="alice@example.com, bob@example.com"
          />
        </div>
      ) : null}

      <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          id="channel-enabled"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          style={{ width: 16, height: 16 }}
        />
        <label htmlFor="channel-enabled" style={{ margin: 0, cursor: "pointer" }}>
          Enabled
        </label>
      </div>

      {error ? (
        <p style={{ color: "var(--level-error)", marginTop: 12, fontSize: 14 }}>{error}</p>
      ) : null}

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button type="submit" className="btn" disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => router.push("/alerts?tab=channels")}
        >
          Done
        </button>
      </div>
    </form>
  );
}
