"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";

interface AuditLogFiltersProps {
  actions: readonly string[];
  initial: { action?: string; actor?: string; since?: string; until?: string };
}

export function AuditLogFilters({ actions, initial }: AuditLogFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState(initial.action ?? "");
  const [actor, setActor] = useState(initial.actor ?? "");

  function applyFilters(next: { action?: string; actor?: string }) {
    const params = new URLSearchParams(searchParams);
    if (next.action !== undefined) {
      if (next.action) params.set("action", next.action);
      else params.delete("action");
    }
    if (next.actor !== undefined) {
      if (next.actor) params.set("actor", next.actor);
      else params.delete("actor");
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(180px, 240px) minmax(180px, 240px) auto",
        gap: 12,
        marginBottom: 20,
      }}
    >
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="audit-action">Action</label>
        <select
          id="audit-action"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            applyFilters({ action: e.target.value });
          }}
          disabled={pending}
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="audit-actor">Actor user ID</label>
        <input
          id="audit-actor"
          type="text"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          onBlur={() => applyFilters({ actor })}
          placeholder="user_..."
          disabled={pending}
        />
      </div>

      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending || (!action && !actor)}
          onClick={() => {
            setAction("");
            setActor("");
            startTransition(() => router.push(pathname));
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
