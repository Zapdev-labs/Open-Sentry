export interface SdkOptions {
  dsn: string;
  environment?: string;
  release?: string;
  sampleRate?: number;
  tracesSampleRate?: number;
  maxBreadcrumbs?: number;
}

export interface Breadcrumb {
  category?: string;
  message?: string;
  level?: "debug" | "info" | "warning" | "error";
  timestamp?: string;
}

export interface ParsedDsn {
  publicKey: string;
  ingestUrl: string;
}

export function parseDsn(dsn: string): ParsedDsn {
  const url = new URL(dsn);
  const publicKey = url.username;
  if (!publicKey) {
    throw new Error("Invalid DSN: missing public key");
  }
  const ingestUrl = `${url.protocol}//${url.host}${url.pathname}?key=${encodeURIComponent(publicKey)}`;
  return { publicKey, ingestUrl };
}

export function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function parseStack(error: Error): Array<{
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  inApp?: boolean;
}> {
  if (!error.stack) return [];
  const lines = error.stack.split("\n").slice(1);
  return lines.slice(0, 20).map((line) => {
    const match = line.match(/at\s+(?:(.+?)\s+\()?(?:(.+?):(\d+):(\d+)|\(<anonymous>\))/);
    return {
      function: match?.[1] ?? "anonymous",
      filename: match?.[2],
      lineno: match?.[3] ? Number(match[3]) : undefined,
      colno: match?.[4] ? Number(match[4]) : undefined,
      inApp: true,
    };
  });
}
