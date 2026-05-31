"use client";

import { useState } from "react";
import type { Breadcrumb } from "@sentry-clone/db";

interface BreadcrumbPanelProps {
  crumbs: Breadcrumb[];
}

const TYPE_ICONS: Record<string, string> = {
  navigation: "nav",
  http: "http",
  console: "log",
  ui: "ui",
  default: "evt",
};

function formatTime(timestamp: string | undefined): string {
  if (!timestamp) return "—";
  try {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  } catch {
    return timestamp;
  }
}

function levelClass(level: string | undefined): string {
  switch (level) {
    case "error":
      return "badge-level-error";
    case "warning":
      return "badge-level-warning";
    case "debug":
      return "badge-level-info";
    default:
      return "badge-level-info";
  }
}

function BreadcrumbData({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v != null);
  if (entries.length === 0) return null;

  return (
    <dl className="breadcrumb-data">
      {entries.map(([key, value]) => (
        <div key={key} className="breadcrumb-data-row">
          <dt>{key}</dt>
          <dd>{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BreadcrumbPanel({ crumbs }: BreadcrumbPanelProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (crumbs.length === 0) {
    return <p className="meta">No breadcrumbs recorded.</p>;
  }

  return (
    <ul className="breadcrumb-timeline">
      {crumbs.map((crumb, i) => {
        const hasData = crumb.data && Object.keys(crumb.data).length > 0;
        const isExpanded = expanded === i;
        const typeKey = crumb.type ?? crumb.category ?? "default";
        const typeLabel = TYPE_ICONS[typeKey.split(".")[0] ?? "default"] ?? "evt";

        return (
          <li key={`${crumb.timestamp}-${i}`} className="breadcrumb-item">
            <button
              type="button"
              className="breadcrumb-row"
              onClick={() => hasData && setExpanded(isExpanded ? null : i)}
              disabled={!hasData}
            >
              <span className="breadcrumb-time">{formatTime(crumb.timestamp)}</span>
              <span className="breadcrumb-type">{typeLabel}</span>
              <span className="breadcrumb-content">
                <span className="breadcrumb-category">{crumb.category ?? "default"}</span>
                <span className="breadcrumb-message">{crumb.message ?? "—"}</span>
              </span>
              {crumb.level && (
                <span className={`badge ${levelClass(crumb.level)}`}>{crumb.level}</span>
              )}
              {hasData && (
                <span className="breadcrumb-expand">{isExpanded ? "−" : "+"}</span>
              )}
            </button>
            {isExpanded && crumb.data && <BreadcrumbData data={crumb.data} />}
          </li>
        );
      })}
    </ul>
  );
}
