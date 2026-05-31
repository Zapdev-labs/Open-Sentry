export type StackFrame = {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  inApp?: boolean;
};

export type BreadcrumbPayload = {
  category?: string;
  message?: string;
  level?: string;
  timestamp?: string;
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

export type IngestItem = ErrorIngestItem | TransactionIngestItem;
