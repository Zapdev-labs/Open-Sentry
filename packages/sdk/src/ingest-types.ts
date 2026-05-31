export type StackFrame = {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  inApp?: boolean;
  module?: string;
  absPath?: string;
};

export type BreadcrumbPayload = {
  category?: string;
  message?: string;
  level?: string;
  timestamp?: string;
  type?: string;
  data?: Record<string, unknown>;
};

export type SpanPayload = {
  spanId: string;
  parentSpanId?: string;
  op: string;
  description?: string;
  durationMs: number;
};

export type ErrorIngestItem = {
  type: "error";
  exception: {
    type?: string;
    value?: string;
    stacktrace?: { frames?: StackFrame[] };
  };
  message?: string;
  level?: "fatal" | "error" | "warning" | "info" | "debug";
  breadcrumbs?: BreadcrumbPayload[];
  tags?: Record<string, string>;
  user?: Record<string, string>;
  environment?: string;
  release?: string;
  timestamp?: string;
};

export type TransactionIngestItem = {
  type: "transaction";
  name: string;
  traceId: string;
  durationMs: number;
  status?: "ok" | "error" | "cancelled";
  spans?: SpanPayload[];
  environment?: string;
  release?: string;
  timestamp?: string;
};

export type AiGenerationIngestItem = {
  type: "ai_generation";
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens?: number;
  totalTokens?: number;
  inputCostUsd?: number;
  outputCostUsd?: number;
  totalCostUsd?: number;
  latencyMs?: number;
  timeToFirstTokenMs?: number;
  status?: "ok" | "error";
  traceId?: string;
  spanId?: string;
  tags?: Record<string, string>;
  user?: Record<string, string>;
  metadata?: Record<string, unknown>;
  environment?: string;
  release?: string;
  timestamp?: string;
};

export type IngestItem = ErrorIngestItem | TransactionIngestItem | AiGenerationIngestItem;
