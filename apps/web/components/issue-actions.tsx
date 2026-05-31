"use client";

import { useRouter } from "next/navigation";

interface IssueActionsProps {
  issueId: string;
  status: string;
  compact?: boolean;
}

export function IssueActions({ issueId, status, compact }: IssueActionsProps) {
  const router = useRouter();

  async function updateStatus(newStatus: "open" | "resolved" | "ignored") {
    await fetch(`/api/issues/${issueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
  }

  if (compact) {
    return (
      <div style={{ display: "flex", gap: 6 }}>
        {status !== "resolved" && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: "4px 10px", fontSize: 12 }}
            onClick={() => updateStatus("resolved")}
          >
            Resolve
          </button>
        )}
        {status !== "ignored" && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: "4px 10px", fontSize: 12 }}
            onClick={() => updateStatus("ignored")}
          >
            Ignore
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
      {status !== "resolved" && (
        <button type="button" className="btn" onClick={() => updateStatus("resolved")}>
          Resolve
        </button>
      )}
      {status !== "ignored" && (
        <button type="button" className="btn btn-secondary" onClick={() => updateStatus("ignored")}>
          Ignore
        </button>
      )}
      {status !== "open" && (
        <button type="button" className="btn btn-secondary" onClick={() => updateStatus("open")}>
          Reopen
        </button>
      )}
    </div>
  );
}
