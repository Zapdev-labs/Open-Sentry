"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash, ArrowRight, BellRinging, Lightning } from "@phosphor-icons/react";

export type AlertRuleRow = {
  id: string;
  name: string;
  description: string | null;
  ruleType: string;
  thresholdCount: number;
  thresholdWindow: number;
  environment: string | null;
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggeredAt: Date | string | null;
  channelIds: string[];
  projectId: string | null;
};

export type AlertChannelRow = {
  id: string;
  name: string;
  channelType: string;
  enabled: boolean;
  ruleCount: number;
  createdAt: Date | string;
};

export type AlertDeliveryRow = {
  id: string;
  ruleName: string;
  channelName: string;
  status: "pending" | "delivered" | "failed" | "rate_limited";
  responseCode: number | null;
  errorMessage: string | null;
  attempt: number;
  sentAt: Date | string | null;
  createdAt: Date | string;
};

function formatRelative(date: Date | string | null): string {
  if (!date) return "Never";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const RULE_TYPE_LABEL: Record<string, string> = {
  "issue.count_threshold": "Issue count",
  "issue.new": "New issue",
  "issue.regression": "Regression",
  "issue.frequency_spike": "Frequency spike",
  "transaction.error_rate": "Error rate",
  "transaction.p95_latency": "p95 latency",
  "uptime.down": "Uptime down",
  "uptime.recovered": "Uptime recovered",
};

const CHANNEL_TYPE_LABEL: Record<string, string> = {
  slack: "Slack",
  discord: "Discord",
  msteams: "MS Teams",
  webhook: "Webhook",
  pagerduty: "PagerDuty",
  email: "Email",
};

interface AlertRuleListProps {
  rules: AlertRuleRow[];
  projectId?: string;
}

export function AlertRuleList({ rules, projectId }: AlertRuleListProps) {
  const router = useRouter();
  const [list, setList] = useState(rules);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleDelete(rule: AlertRuleRow) {
    if (!window.confirm(`Delete alert rule "${rule.name}"?`)) return;
    setDeletingId(rule.id);
    const res = await fetch(`/api/alerts/rules/${rule.id}`, { method: "DELETE" });
    if (res.ok) {
      setList((cur) => cur.filter((r) => r.id !== rule.id));
      startTransition(() => router.refresh());
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(data.error ?? "Failed to delete");
    }
    setDeletingId(null);
  }

  if (list.length === 0) {
    return (
      <div className="card fade-in" style={{ textAlign: "center", padding: 48 }}>
        <Lightning
          size={32}
          weight="bold"
          style={{ color: "var(--text-muted)", marginBottom: 12 }}
        />
        <h3 style={{ fontSize: 18, marginBottom: 8 }}>No alert rules yet</h3>
        <p className="meta">
          Create a rule to get notified when errors spike, transactions slow down, or your
          uptime monitors go down.
        </p>
        <Link
          href={projectId ? `/alerts/rules/new?projectId=${projectId}` : "/alerts/rules/new"}
          className="btn"
          style={{ marginTop: 16, display: "inline-flex" }}
        >
          Create your first rule
        </Link>
      </div>
    );
  }

  return (
    <div className="card fade-in">
      <div style={{ overflowX: "auto" }}>
        <table className="table-editorial">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Threshold</th>
              <th>Window</th>
              <th>Channels</th>
              <th>Last fired</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((rule) => (
              <tr key={rule.id}>
                <td style={{ fontWeight: 500 }}>
                  <Link
                    href={`/alerts/rules/${rule.id}`}
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    {rule.name}
                  </Link>
                  {rule.environment ? (
                    <span className="meta" style={{ marginLeft: 8, fontSize: 12 }}>
                      · {rule.environment}
                    </span>
                  ) : null}
                </td>
                <td className="meta">{RULE_TYPE_LABEL[rule.ruleType] ?? rule.ruleType}</td>
                <td>{rule.thresholdCount}</td>
                <td className="meta">{rule.thresholdWindow}m</td>
                <td className="meta">{rule.channelIds.length}</td>
                <td className="meta">{formatRelative(rule.lastTriggeredAt)}</td>
                <td>
                  <span
                    className={`badge ${rule.enabled ? "badge-resolved" : "badge-info"}`}
                  >
                    {rule.enabled ? "enabled" : "disabled"}
                  </span>
                </td>
                <td>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      justifyContent: "flex-end",
                    }}
                  >
                    <Link
                      href={`/alerts/rules/${rule.id}`}
                      className="meta"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        textDecoration: "none",
                      }}
                    >
                      Edit <ArrowRight size={12} weight="bold" />
                    </Link>
                    <button
                      type="button"
                      className="meta"
                      onClick={() => handleDelete(rule)}
                      disabled={deletingId === rule.id}
                      aria-label={`Delete ${rule.name}`}
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
                      {deletingId === rule.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface AlertChannelListProps {
  channels: AlertChannelRow[];
}

export function AlertChannelList({ channels }: AlertChannelListProps) {
  const router = useRouter();
  const [list, setList] = useState(channels);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleDelete(channel: AlertChannelRow) {
    if (
      !window.confirm(
        `Delete channel "${channel.name}"? ${channel.ruleCount} rule${channel.ruleCount === 1 ? "" : "s"} ${channel.ruleCount === 1 ? "is" : "are"} using it.`
      )
    ) {
      return;
    }
    setDeletingId(channel.id);
    const res = await fetch(`/api/alerts/channels/${channel.id}`, { method: "DELETE" });
    if (res.ok) {
      setList((cur) => cur.filter((c) => c.id !== channel.id));
      startTransition(() => router.refresh());
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(data.error ?? "Failed to delete");
    }
    setDeletingId(null);
  }

  if (list.length === 0) {
    return (
      <div className="card fade-in" style={{ textAlign: "center", padding: 48 }}>
        <BellRinging
          size={32}
          weight="bold"
          style={{ color: "var(--text-muted)", marginBottom: 12 }}
        />
        <h3 style={{ fontSize: 18, marginBottom: 8 }}>No alert channels yet</h3>
        <p className="meta">
          Add a Slack, Discord, email, or webhook destination to start receiving alert
          notifications.
        </p>
        <Link
          href="/alerts/channels/new"
          className="btn"
          style={{ marginTop: 16, display: "inline-flex" }}
        >
          Create your first channel
        </Link>
      </div>
    );
  }

  return (
    <div className="card fade-in">
      <div style={{ overflowX: "auto" }}>
        <table className="table-editorial">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Rules</th>
              <th>Status</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((channel) => (
              <tr key={channel.id}>
                <td style={{ fontWeight: 500 }}>
                  <Link
                    href={`/alerts/channels/${channel.id}`}
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    {channel.name}
                  </Link>
                </td>
                <td className="meta">
                  {CHANNEL_TYPE_LABEL[channel.channelType] ?? channel.channelType}
                </td>
                <td className="meta">{channel.ruleCount}</td>
                <td>
                  <span
                    className={`badge ${channel.enabled ? "badge-resolved" : "badge-info"}`}
                  >
                    {channel.enabled ? "enabled" : "disabled"}
                  </span>
                </td>
                <td className="meta">{formatRelative(channel.createdAt)}</td>
                <td>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      justifyContent: "flex-end",
                    }}
                  >
                    <Link
                      href={`/alerts/channels/${channel.id}`}
                      className="meta"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        textDecoration: "none",
                      }}
                    >
                      Edit <ArrowRight size={12} weight="bold" />
                    </Link>
                    <button
                      type="button"
                      className="meta"
                      onClick={() => handleDelete(channel)}
                      disabled={deletingId === channel.id}
                      aria-label={`Delete ${channel.name}`}
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
                      {deletingId === channel.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface AlertDeliveryListProps {
  deliveries: AlertDeliveryRow[];
}

const STATUS_BADGE: Record<AlertDeliveryRow["status"], "resolved" | "error" | "info" | "warning"> = {
  delivered: "resolved",
  failed: "error",
  pending: "info",
  rate_limited: "warning",
};

export function AlertDeliveryList({ deliveries }: AlertDeliveryListProps) {
  if (deliveries.length === 0) {
    return (
      <p className="meta" style={{ padding: "24px 0" }}>
        No deliveries yet. When an alert rule fires, deliveries will appear here.
      </p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="table-editorial">
        <thead>
          <tr>
            <th>Rule</th>
            <th>Channel</th>
            <th>Status</th>
            <th>Response</th>
            <th>Sent</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((d) => (
            <tr key={d.id}>
              <td style={{ fontWeight: 500 }}>{d.ruleName}</td>
              <td className="meta">{d.channelName}</td>
              <td>
                <span className={`badge badge-${STATUS_BADGE[d.status]}`}>{d.status}</span>
              </td>
              <td className="meta" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                {d.responseCode ?? "—"}
                {d.errorMessage ? ` · ${d.errorMessage}` : ""}
              </td>
              <td className="meta">{formatRelative(d.sentAt ?? d.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
