import { createHash } from "node:crypto";
import type { Breadcrumb, StackFrame } from "./schema";

export interface ExceptionPayload {
  type?: string;
  value?: string;
  stacktrace?: {
    frames?: StackFrame[];
  };
}

const LEVEL_MAP: Record<string, "fatal" | "error" | "warning" | "info" | "debug"> = {
  fatal: "fatal",
  error: "error",
  warning: "warning",
  warn: "warning",
  info: "info",
  debug: "debug",
};

export function resolveLevel(
  exception: ExceptionPayload,
  explicitLevel?: string,
  message?: string
): "fatal" | "error" | "warning" | "info" | "debug" {
  if (explicitLevel && LEVEL_MAP[explicitLevel.toLowerCase()]) {
    return LEVEL_MAP[explicitLevel.toLowerCase()]!;
  }
  const type = (exception.type ?? message ?? "error").toLowerCase();
  return LEVEL_MAP[type] ?? "error";
}

export function computeFingerprint(
  exception: ExceptionPayload,
  message?: string,
  explicitLevel?: string
): { fingerprint: string; title: string; level: "fatal" | "error" | "warning" | "info" | "debug" } {
  const type = exception.type ?? "Error";
  const value = exception.value ?? message ?? "Unknown error";
  const title = `${type}: ${value}`.slice(0, 500);
  const level = resolveLevel(exception, explicitLevel, message);

  const frames = exception.stacktrace?.frames ?? [];
  const inAppFrames = frames.filter((f) => f.inApp !== false);
  const relevantFrames = (inAppFrames.length > 0 ? inAppFrames : frames)
    .slice(-3)
    .map((f) => `${f.filename ?? "?"}:${f.function ?? "?"}`)
    .join("|");

  const hashInput = `${type}|${value}|${relevantFrames}`;
  const fingerprint = createHash("sha256").update(hashInput).digest("hex");

  return { fingerprint, title, level };
}

export function normalizeStackFrames(raw: StackFrame[] | undefined): StackFrame[] {
  if (!raw) return [];
  return raw.slice(0, 100).map((frame) => ({
    filename: frame.filename,
    function: frame.function,
    lineno: frame.lineno,
    colno: frame.colno,
    inApp: frame.inApp ?? true,
    module: frame.module,
    absPath: frame.absPath ?? frame.filename,
    contextLine: frame.contextLine,
    preContext: frame.preContext,
    postContext: frame.postContext,
  }));
}

export function normalizeBreadcrumbs(raw: Breadcrumb[] | undefined, max = 50): Breadcrumb[] {
  if (!raw) return [];
  return raw.slice(-max).map((crumb) => ({
    category: crumb.category,
    message: crumb.message?.slice(0, 1000),
    level: crumb.level,
    timestamp: crumb.timestamp,
    type: crumb.type,
    data: crumb.data,
  }));
}
