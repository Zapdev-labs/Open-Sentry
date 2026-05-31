"use client";

import { useState } from "react";
import { Copy, Check } from "@phosphor-icons/react";

export function CopyDsn({ dsn }: { dsn: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(dsn);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <code
        className="code-block"
        style={{ flex: 1, display: "block", padding: "10px 14px", wordBreak: "break-all" }}
      >
        {dsn}
      </code>
      <button type="button" className="btn btn-secondary" onClick={handleCopy} aria-label="Copy DSN">
        {copied ? <Check size={18} weight="bold" /> : <Copy size={18} weight="bold" />}
      </button>
    </div>
  );
}
