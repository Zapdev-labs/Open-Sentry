"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChannelSelect, type AlertChannelOption } from "./alert-forms";
import type { AlertChannelConfig, AlertRuleQuery } from "@sentry-clone/db";

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

interface AlertRuleFormProps {
  rule: {
    id: string;
    name: string;
    description: string | null;
    ruleType: string;
    thresholdCount: number;
    thresholdWindow: number;
    environment: string | null;
    enabled: boolean;
    cooldownMinutes: number;
    channelIds: string[];
    query: AlertRuleQuery;
  };
  channels: AlertChannelOption[];
}

export function AlertRuleForm({ rule, channels }: AlertRuleFormProps) {
  const router = useRouter();
  const [name, setName] = useState(rule.name);
  const [description, setDescription] = useState(rule.description ?? "");
  const [ruleType, setRuleType] = useState<string>(rule.ruleType);
  const [thresholdWindow, setThresholdWindow] = useState(rule.thresholdWindow);
  const [thresholdCount, setThresholdCount] = useState(rule.thresholdCount);
  const [cooldownMinutes, setCooldownMinutes] = useState(rule.cooldownMinutes);
  const [environment, setEnvironment] = useState(rule.environment ?? "");
  const [enabled, setEnabled] = useState(rule.enabled);
  const [levels, setLevels] = useState<string[]>(rule.query.levels ?? []);
  const [transactionName, setTransactionName] = useState(rule.query.transactionName ?? "");
  const [selectedChannels, setSelectedChannels] = useState<string[]>(rule.channelIds);
  const [saving, setSaving] = useState(false);
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
    setSaving(true);
    setError(null);

    const query: AlertRuleQuery = {};
    if (ruleType.startsWith("issue.")) {
      if (levels.length > 0) query.levels = levels as AlertRuleQuery["levels"];
    } else if (ruleType.startsWith("transaction.")) {
      if (transactionName.trim()) query.transactionName = transactionName.trim();
    }

    const res = await fetch(`/api/alerts/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || undefined,
        ruleType,
        thresholdWindow,
        thresholdCount,
        cooldownMinutes,
        environment: environment.trim() || null,
        enabled,
        channelIds: selectedChannels,
        query,
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
          <label htmlFor="rule-name">Name</label>
          <input
            id="rule-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="rule-type">Rule type</label>
          <select id="rule-type" value={ruleType} onChange={(e) => setRuleType(e.target.value)}>
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
          <label htmlFor="env">Environment</label>
          <input
            id="env"
            type="text"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            placeholder="any"
          />
        </div>
      </div>

      {ruleType.startsWith("issue.") ? (
        <div className="form-group">
          <label>Levels</label>
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
          <label htmlFor="tx-name">Transaction name</label>
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
        <ChannelSelect
          channels={channels}
          value={selectedChannels}
          onChange={setSelectedChannels}
        />
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
        <button type="submit" className="btn" disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => router.push("/alerts")}
        >
          Done
        </button>
      </div>
    </form>
  );
}
