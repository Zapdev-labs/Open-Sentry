export interface SdkOptions {
  dsn: string;
  environment?: string;
  release?: string;
  sampleRate?: number;
  tracesSampleRate?: number;
  maxBreadcrumbs?: number;
  enableBreadcrumbs?: boolean;
}

export interface Breadcrumb {
  category?: string;
  message?: string;
  level?: "debug" | "info" | "warning" | "error";
  timestamp?: string;
  type?: string;
  data?: Record<string, unknown>;
}

export interface ParsedDsn {
  publicKey: string;
  ingestUrl: string;
}

export interface ParsedStackFrame {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  inApp?: boolean;
  module?: string;
  absPath?: string;
}

const STACK_LINE_PATTERNS = [
  /^\s*at (?:(.+?) \()?(?:(.+?):(\d+):(\d+)|\(<anonymous>\))\)?$/,
  /^\s*at (?:(.+?):(\d+):(\d+)|\(<anonymous>\))$/,
  /^\s*(.+?)@(.+?):(\d+):(\d+)$/,
  /^\s*at async (?:(.+?) \()?(?:(.+?):(\d+):(\d+))\)?$/,
];

const NOT_IN_APP_PATTERNS = [
  /node_modules/,
  /webpack/,
  /vite/,
  /bundled/,
  /node:internal/,
  /node:async_hooks/,
  /^bun:/,
  /^internal\//,
  /^<anonymous>$/,
  /eval at/,
  /^\[native code\]$/,
];

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

export function isInAppFrame(filename: string | undefined, fn: string | undefined): boolean {
  const path = filename ?? "";
  const func = fn ?? "";
  if (!path && func === "anonymous") return false;
  return !NOT_IN_APP_PATTERNS.some((pattern) => pattern.test(path) || pattern.test(func));
}

function extractModule(filename: string | undefined): string | undefined {
  if (!filename) return undefined;
  const parts = filename.replace(/\\/g, "/").split("/");
  const file = parts[parts.length - 1];
  return file?.includes(".") ? file.replace(/\.[^.]+$/, "") : file;
}

function parseStackLine(line: string): ParsedStackFrame | null {
  for (const pattern of STACK_LINE_PATTERNS) {
    const match = line.match(pattern);
    if (!match) continue;

    if (match.length === 5 && match[2]) {
      const fn = match[1]?.trim() || "anonymous";
      const filename = match[2];
      return buildFrame(fn, filename, match[3], match[4]);
    }

    if (match.length === 4 && match[1]?.includes(":")) {
      return buildFrame("anonymous", match[1], match[2], match[3]);
    }

    if (match.length === 4 && match[2]) {
      const fn = match[1]?.trim() || "anonymous";
      return buildFrame(fn, match[2], match[3], match[4]);
    }
  }

  const fallback = line.match(/^\s*at\s+(.+)$/);
  if (fallback) {
    return {
      function: fallback[1]?.trim() || "anonymous",
      inApp: true,
    };
  }

  return null;
}

function buildFrame(
  fn: string,
  filename: string | undefined,
  lineStr: string | undefined,
  colStr: string | undefined
): ParsedStackFrame {
  const normalizedPath = filename?.replace(/\\/g, "/");
  return {
    function: fn === "?" ? "anonymous" : fn,
    filename: normalizedPath,
    absPath: normalizedPath,
    module: extractModule(normalizedPath),
    lineno: lineStr ? Number(lineStr) : undefined,
    colno: colStr ? Number(colStr) : undefined,
    inApp: isInAppFrame(normalizedPath, fn),
  };
}

export function parseStack(error: Error, maxFrames = 50): ParsedStackFrame[] {
  if (!error.stack) return [];

  const lines = error.stack.split("\n").slice(1);
  const frames: ParsedStackFrame[] = [];

  for (const line of lines) {
    if (frames.length >= maxFrames) break;
    const frame = parseStackLine(line);
    if (frame) frames.push(frame);
  }

  return frames;
}

export function levelFromExceptionType(type: string | undefined): "fatal" | "error" | "warning" | "info" | "debug" {
  const normalized = (type ?? "error").toLowerCase();
  if (normalized === "fatal") return "fatal";
  if (normalized === "warning" || normalized === "warn") return "warning";
  if (normalized === "info") return "info";
  if (normalized === "debug") return "debug";
  return "error";
}
