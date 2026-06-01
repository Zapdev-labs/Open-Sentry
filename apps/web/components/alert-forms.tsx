"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "@phosphor-icons/react";

export type AlertChannelOption = {
  id: string;
  name: string;
  channelType: string;
  enabled: boolean;
};

interface ChannelSelectProps {
  channels: AlertChannelOption[];
  value: string[];
  onChange: (value: string[]) => void;
}

export function ChannelSelect({ channels, value, onChange }: ChannelSelectProps) {
  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  }

  if (channels.length === 0) {
    return (
      <p className="meta" style={{ fontSize: 13 }}>
        No channels yet. Create one in the Channels tab before assigning it to a rule.
      </p>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 8,
      }}
    >
      {channels.map((channel) => {
        const selected = value.includes(channel.id);
        return (
          <button
            type="button"
            key={channel.id}
            onClick={() => toggle(channel.id)}
            style={{
              padding: "10px 12px",
              border: `1px solid ${selected ? "var(--cta)" : "var(--dash-border)"}`,
              borderRadius: 6,
              background: selected ? "var(--dash-accent-muted)" : "var(--dash-bg)",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                border: `1px solid ${selected ? "var(--cta)" : "var(--text-muted)"}`,
                background: selected ? "var(--cta)" : "transparent",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: 10,
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              {selected ? "✓" : ""}
            </span>
            <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span style={{ fontWeight: 500, fontSize: 14 }}>{channel.name}</span>
              <span className="meta" style={{ fontSize: 12 }}>
                {channel.channelType}
                {channel.enabled ? "" : " · disabled"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface CreateRuleFormProps {
  projectId?: string | null;
  channels: AlertChannelOption[];
}

const RULE_TYPE_OPTIONS = [
  { value: "issue.count_threshold", label: "Issue count threshold" },
  { value: "issue.new", label: "New issue" },
  { value: "issue.regression", label: "Issue regression" },
  { value: "issue.frequency_spike", label: "Issue frequency spike" },
  { value: "transaction.error_rate", label: "Transaction error rate" },
  { value: "transaction.p95_latency", label: "Transaction p95 latency" },
  { value: "uptime.down", label: "Uptime monitor down" },
  { value: "uptime.recovered", label: "Uptime monitor recovered" },
] as const;

const LEVELS = ["fatal", "error", "warning", "info", "debug"] as const;

export function CreateRuleForm({ projectId, channels }: CreateRuleFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ruleType, setRuleType] = useState<(typeof RULE_TYPE_OPTIONS)[number]["value"]>(
    "issue.count_threshold"
  );
  const [thresholdWindow, setThresholdWindow] = useState(60);
  const [thresholdCount, setThresholdCount] = useState(10);
  const [cooldownMinutes, setCooldownMinutes] = useState(30);
  const [environment, setEnvironment] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [levels, setLevels] = useState<string[]>([]);
  const [transactionName, setTransactionName] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const thresholdLabel =
    ruleType === "transaction.error_rate"
      ? "Threshold (% error rate)"
      : ruleType === "transaction.p95_latency"
        ? "Threshold (ms)"
        : "Threshold (count)";

  function toggleLevel(level: string) {
    if (levels.includes(level)) setLevels(levels.filter((l) => l !== level));
    else setLevels([...levels, level]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);

    const body: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || undefined,
      projectId: projectId ?? null,
      ruleType,
      thresholdWindow,
      thresholdCount,
      cooldownMinutes,
      environment: environment.trim() || null,
      enabled,
      channelIds: selectedChannels,
      query: {},
    };

    if (ruleType.startsWith("issue.")) {
      body.query = {
        levels: levels.length > 0 ? levels : undefined,
      };
    } else if (ruleType.startsWith("transaction.")) {
      body.query = { transactionName: transactionName.trim() || undefined };
    }

    const res = await fetch("/api/alerts/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!res.ok || !data.id) {
      setError(data.error ?? "Failed to create rule");
      setSubmitting(false);
      return;
    }
    router.push(`/alerts/rules/${data.id}`);
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
          <label htmlFor="rule-name">Name</label>
          <input
            id="rule-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Production error spike"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="rule-type">Rule type</label>
          <select
            id="rule-type"
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value as typeof ruleType)}
          >
            {RULE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="rule-description">Description (optional)</label>
        <input
          id="rule-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this alert covers"
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <div className="form-group">
          <label htmlFor="window">Window (minutes)</label>
          <input
            id="window"
            type="number"
            min={1}
            max={10080}
            value={thresholdWindow}
            onChange={(e) => setThresholdWindow(Number(e.target.value) || 1)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="count">{thresholdLabel}</label>
          <input
            id="count"
            type="number"
            min={1}
            max={100000}
            value={thresholdCount}
            onChange={(e) => setThresholdCount(Number(e.target.value) || 1)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="cooldown">Cooldown (minutes)</label>
          <input
            id="cooldown"
            type="number"
            min={0}
            max={10080}
            value={cooldownMinutes}
            onChange={(e) => setCooldownMinutes(Number(e.target.value) || 0)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="env">Environment (optional)</label>
          <input
            id="env"
            type="text"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            placeholder="production"
          />
        </div>
      </div>

      {ruleType.startsWith("issue.") ? (
        <div className="form-group">
          <label>Levels (optional)</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {LEVELS.map((level) => {
              const active = levels.includes(level);
              return (
                <button
                  type="button"
                  key={level}
                  onClick={() => toggleLevel(level)}
                  className={`badge ${active ? "badge-resolved" : "badge-info"}`}
                  style={{
                    cursor: "pointer",
                    border: active ? "1px solid var(--cta)" : "1px solid var(--dash-border)",
                    background: active ? "var(--dash-accent-muted)" : "var(--dash-bg)",
                    color: "var(--text)",
                  }}
                >
                  {level}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {ruleType.startsWith("transaction.") ? (
        <div className="form-group">
          <label htmlFor="tx-name">Transaction name (optional)</label>
          <input
            id="tx-name"
            type="text"
            value={transactionName}
            onChange={(e) => setTransactionName(e.target.value)}
            placeholder="/api/users/:id"
          />
        </div>
      ) : null}

      <div className="form-group">
        <label>Channels</label>
        <ChannelSelect channels={channels} value={selectedChannels} onChange={setSelectedChannels} />
      </div>

      <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          id="enabled"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          style={{ width: 16, height: 16 }}
        />
        <label htmlFor="enabled" style={{ margin: 0, cursor: "pointer" }}>
          Enabled
        </label>
      </div>

      {error ? (
        <p style={{ color: "var(--level-error)", marginTop: 12, fontSize: 14 }}>{error}</p>
      ) : null}

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button type="submit" className="btn" disabled={submitting || !name.trim()}>
          {submitting ? "Creating..." : "Create rule"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => router.push("/alerts")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

interface CreateChannelFormProps {
  projectId?: string | null;
}

const CHANNEL_TYPES = [
  { value: "slack", label: "Slack" },
  { value: "discord", label: "Discord" },
  { value: "msteams", label: "Microsoft Teams" },
  { value: "webhook", label: "Generic webhook" },
  { value: "pagerduty", label: "PagerDuty" },
  { value: "email", label: "Email" },
] as const;

export function CreateChannelForm({ projectId }: CreateChannelFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [channelType, setChannelType] = useState<(typeof CHANNEL_TYPES)[number]["value"]>(
    "slack"
  );
  const [enabled, setEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Channel-specific config fields
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [integrationKey, setIntegrationKey] = useState("");
  const [recipientsText, setRecipientsText] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);

    let config: Record<string, unknown>;
    switch (channelType) {
      case "slack":
      case "discord":
      case "msteams":
        if (!webhookUrl.trim()) {
          setError("Webhook URL is required");
          setSubmitting(false);
          return;
        }
        config = { kind: channelType, webhookUrl: webhookUrl.trim() };
        break;
      case "webhook":
        if (!webhookUrl.trim()) {
          setError("URL is required");
          setSubmitting(false);
          return;
        }
        config = {
          kind: "webhook",
          url: webhookUrl.trim(),
          ...(webhookSecret.trim() ? { secret: webhookSecret.trim() } : {}),
        };
        break;
      case "pagerduty":
        if (!integrationKey.trim()) {
          setError("Integration key is required");
          setSubmitting(false);
          return;
        }
        config = { kind: "pagerduty", integrationKey: integrationKey.trim() };
        break;
      case "email": {
        const recipients = recipientsText
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (recipients.length === 0) {
          setError("At least one recipient is required");
          setSubmitting(false);
          return;
        }
        config = { kind: "email", recipients };
        break;
      }
    }

    const res = await fetch("/api/alerts/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        projectId: projectId ?? null,
        channelType,
        config,
        enabled,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!res.ok || !data.id) {
      setError(data.error ?? "Failed to create channel");
      setSubmitting(false);
      return;
    }
    router.push(`/alerts/channels/${data.id}`);
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
            placeholder="e.g. #oncall-alerts"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="channel-type">Type</label>
          <select
            id="channel-type"
            value={channelType}
            onChange={(e) => setChannelType(e.target.value as typeof channelType)}
          >
            {CHANNEL_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(channelType === "slack" ||
        channelType === "discord" ||
        channelType === "msteams" ||
        channelType === "webhook") && (
        <div className="form-group">
          <label htmlFor="webhook-url">
            {channelType === "webhook" ? "Endpoint URL" : "Webhook URL"}
          </label>
          <input
            id="webhook-url"
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder={
              channelType === "slack"
                ? "https://hooks.slack.com/services/..."
                : channelType === "discord"
                  ? "https://discord.com/api/webhooks/..."
                  : channelType === "msteams"
                    ? "https://outlook.office.com/webhook/..."
                    : "https://example.com/alerts"
            }
            required
          />
        </div>
      )}

      {channelType === "webhook" ? (
        <div className="form-group">
          <label htmlFor="webhook-secret">Signing secret (optional)</label>
          <input
            id="webhook-secret"
            type="text"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="HMAC-SHA256 over the request body"
          />
        </div>
      ) : null}

      {channelType === "pagerduty" ? (
        <div className="form-group">
          <label htmlFor="pagerduty-key">PagerDuty integration key</label>
          <input
            id="pagerduty-key"
            type="text"
            value={integrationKey}
            onChange={(e) => setIntegrationKey(e.target.value)}
            placeholder="32-character Events API v2 key"
            required
          />
        </div>
      ) : null}

      {channelType === "email" ? (
        <div className="form-group">
          <label htmlFor="email-recipients">Recipients</label>
          <input
            id="email-recipients"
            type="text"
            value={recipientsText}
            onChange={(e) => setRecipientsText(e.target.value)}
            placeholder="alice@example.com, bob@example.com"
            required
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
        <button type="submit" className="btn" disabled={submitting || !name.trim()}>
          {submitting ? "Creating..." : "Create channel"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => router.push("/alerts")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

interface NewButtonProps {
  href: string;
  label: string;
}

export function NewButton({ href, label }: NewButtonProps) {
  return (
    <a
      href={href}
      className="btn"
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
    >
      <Plus size={14} weight="bold" />
      {label}
    </a>
  );
}

interface CloseButtonProps {
  onClick: () => void;
}

export function CloseButton({ onClick }: CloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
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
  );
}
