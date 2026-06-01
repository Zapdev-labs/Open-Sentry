"use client";

import { useEffect } from "react";
import { Warning } from "@phosphor-icons/react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] render error:", error);
  }, [error]);

  return (
    <main className="dash-page">
      <div
        className="card fade-in"
        style={{ borderColor: "var(--level-error)", maxWidth: 560 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Warning size={20} weight="bold" color="var(--level-error)" />
          <h2 style={{ fontSize: 18, margin: 0 }}>Something went wrong</h2>
        </div>
        <p className="meta" style={{ marginBottom: 8 }}>
          {error.message || "An unexpected error occurred while rendering this page."}
        </p>
        {error.digest ? (
          <p className="meta" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
            Reference: {error.digest}
          </p>
        ) : null}
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button type="button" className="btn" onClick={() => reset()}>
            Try again
          </button>
        </div>
      </div>
    </main>
  );
}
