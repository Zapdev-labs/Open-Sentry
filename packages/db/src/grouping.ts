import { createHash } from "node:crypto";
import type { StackFrame } from "./schema";

export interface ExceptionPayload {
  type?: string;
  value?: string;
  stacktrace?: {
    frames?: StackFrame[];
  };
}

export function computeFingerprint(
  exception: ExceptionPayload,
  message?: string
): { fingerprint: string; title: string; level: string } {
  const type = exception.type ?? "Error";
  const value = exception.value ?? message ?? "Unknown error";
  const title = `${type}: ${value}`.slice(0, 500);

  const frames = exception.stacktrace?.frames ?? [];
  const inAppFrames = frames.filter((f) => f.inApp !== false);
  const relevantFrames = (inAppFrames.length > 0 ? inAppFrames : frames)
    .slice(-3)
    .map((f) => `${f.filename ?? "?"}:${f.function ?? "?"}`)
    .join("|");

  const hashInput = `${type}|${value}|${relevantFrames}`;
  const fingerprint = createHash("sha256").update(hashInput).digest("hex");

  return { fingerprint, title, level: "error" };
}

export function normalizeStackFrames(raw: StackFrame[] | undefined): StackFrame[] {
  if (!raw) return [];
  return raw.map((frame) => ({
    filename: frame.filename,
    function: frame.function,
    lineno: frame.lineno,
    colno: frame.colno,
    inApp: frame.inApp ?? true,
  }));
}
