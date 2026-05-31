"use client";

import { useState } from "react";
import type { Event } from "@sentry-clone/db";
import { StackPanel } from "@/components/stack-panel";
import { BreadcrumbPanel } from "@/components/breadcrumb-panel";
import { EventContextPanel } from "@/components/event-context-panel";

interface IssueEventExplorerProps {
  events: Event[];
}

export function IssueEventExplorer({ events }: IssueEventExplorerProps) {
  const [selectedId, setSelectedId] = useState(events[0]?.id ?? "");
  const selected = events.find((e) => e.id === selectedId) ?? events[0];

  if (!selected) {
    return <p className="meta">No events recorded for this issue.</p>;
  }

  return (
    <div className="event-explorer">
      <div className="event-explorer-sidebar card">
        <h4 className="context-heading">Events ({events.length})</h4>
        <ul className="event-list">
          {events.map((event, i) => (
            <li key={event.id}>
              <button
                type="button"
                className={`event-list-item ${event.id === selected.id ? "active" : ""}`}
                onClick={() => setSelectedId(event.id)}
                style={{ "--index": i } as React.CSSProperties}
              >
                <span className="event-list-time">
                  {event.timestamp.toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <span className="event-list-message">{event.message}</span>
                {event.environment && (
                  <span className="event-list-env">{event.environment}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="event-explorer-detail">
        <EventContextPanel
          tags={selected.tags}
          user={selected.user}
          environment={selected.environment}
          release={selected.release}
          timestamp={selected.timestamp}
        />

        <div className="two-col" style={{ marginTop: 24 }}>
          <div>
            <h3 style={{ fontSize: 18, marginBottom: 16 }}>Stack trace</h3>
            <StackPanel frames={selected.stack} />
          </div>
          <div>
            <h3 style={{ fontSize: 18, marginBottom: 16 }}>Breadcrumbs</h3>
            <div className="card" style={{ padding: 20 }}>
              <BreadcrumbPanel crumbs={selected.breadcrumbs} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
