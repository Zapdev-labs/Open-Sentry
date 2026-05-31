export type EventLevel = "fatal" | "error" | "warning" | "info" | "debug";

export type StackFrame = {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  inApp?: boolean;
};

export type Breadcrumb = {
  category?: string;
  message?: string;
  level?: EventLevel;
  timestamp?: string;
  data?: Record<string, string>;
};

export type ErrorPayload = {
  type: "error";
  level?: EventLevel;
  exception: {
    type?: string;
    value?: string;
    stacktrace?: { frames?: StackFrame[] };
  };
  breadcrumbs?: Breadcrumb[];
  tags?: Record<string, string>;
  user?: Record<string, string>;
  environment?: string;
  release?: string;
  timestamp?: string;
};

export type SpanPayload = {
  spanId: string;
  parentSpanId?: string;
  op: string;
  description?: string;
  durationMs: number;
};

export type TransactionPayload = {
  type: "transaction";
  name: string;
  traceId: string;
  durationMs: number;
  status?: string;
  spans?: SpanPayload[];
  environment?: string;
  release?: string;
  timestamp?: string;
};

export type IngestPayload = ErrorPayload | TransactionPayload;

export type InitOptions = {
  dsn: string;
  environment?: string;
  release?: string;
  sampleRate?: number;
  tracesSampleRate?: number;
  maxBreadcrumbs?: number;
  flushIntervalMs?: number;
  maxBatchSize?: number;
};

export type ParsedDsn = {
  publicKey: string;
  ingestUrl: string;
};

export type ActiveTransaction = {
  name: string;
  traceId: string;
  startTime: number;
  spans: SpanPayload[];
  finish: (status?: string) => void;
  startChild: (op: string, description?: string) => ActiveSpan;
};

export type ActiveSpan = {
  spanId: string;
  finish: () => void;
};
