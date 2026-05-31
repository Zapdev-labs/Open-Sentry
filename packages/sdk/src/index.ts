import type { IngestItem } from "./ingest-types.js";
import { randomId, parseStack, type Breadcrumb, type SdkOptions } from "./utils.js";
import { Transport } from "./transport.js";

interface ActiveSpan {
  spanId: string;
  op: string;
  description?: string;
  startTime: number;
  parentSpanId?: string;
}

interface ActiveTransaction {
  name: string;
  traceId: string;
  startTime: number;
  spans: ActiveSpan[];
  rootSpanId: string;
}

let transport: Transport | null = null;
let options: Required<Pick<SdkOptions, "environment" | "release" | "sampleRate" | "tracesSampleRate" | "maxBreadcrumbs">> = {
  environment: "production",
  release: "unknown",
  sampleRate: 1.0,
  tracesSampleRate: 0.1,
  maxBreadcrumbs: 50,
};
const breadcrumbs: Breadcrumb[] = [];
let globalHandlersInstalled = false;

export function init(opts: SdkOptions): void {
  if (!opts.dsn) throw new Error("DSN is required");
  transport = new Transport(opts.dsn);
  options = {
    environment: opts.environment ?? "production",
    release: opts.release ?? "unknown",
    sampleRate: opts.sampleRate ?? 1.0,
    tracesSampleRate: opts.tracesSampleRate ?? 0.1,
    maxBreadcrumbs: opts.maxBreadcrumbs ?? 50,
  };
  installGlobalHandlers();
  installNodeExitHandler();
}

export function addBreadcrumb(crumb: Breadcrumb): void {
  breadcrumbs.push({
    ...crumb,
    timestamp: crumb.timestamp ?? new Date().toISOString(),
  });
  while (breadcrumbs.length > options.maxBreadcrumbs) {
    breadcrumbs.shift();
  }
}

export function captureException(error: unknown): void {
  if (!transport) return;
  if (Math.random() > options.sampleRate) return;

  const err = error instanceof Error ? error : new Error(String(error));
  const item: IngestItem = {
    type: "error",
    exception: {
      type: err.name,
      value: err.message,
      stacktrace: { frames: parseStack(err) },
    },
    breadcrumbs: [...breadcrumbs],
    environment: options.environment,
    release: options.release,
    timestamp: new Date().toISOString(),
  };
  transport.enqueue(item);
}

export function captureMessage(message: string, level: "info" | "warning" | "error" = "info"): void {
  if (!transport) return;
  if (Math.random() > options.sampleRate) return;

  const item: IngestItem = {
    type: "error",
    exception: {
      type: level,
      value: message,
    },
    breadcrumbs: [...breadcrumbs],
    environment: options.environment,
    release: options.release,
    timestamp: new Date().toISOString(),
  };
  transport.enqueue(item);
}

export interface TransactionHandle {
  finish: (status?: "ok" | "error" | "cancelled") => void;
  startChild: (op: string, description?: string) => SpanHandle;
}

export interface SpanHandle {
  finish: () => void;
}

export function startTransaction(name: string): TransactionHandle {
  const traceId = randomId();
  const rootSpanId = randomId();
  const startTime = performance.now();
  const tx: ActiveTransaction = {
    name,
    traceId,
    startTime,
    rootSpanId,
    spans: [],
  };

  const activeSpans = new Map<string, ActiveSpan>();

  return {
    finish(status: "ok" | "error" | "cancelled" = "ok") {
      if (!transport) return;
      if (Math.random() > options.tracesSampleRate) return;

      const durationMs = Math.round(performance.now() - startTime);
      const item: IngestItem = {
        type: "transaction",
        name: tx.name,
        traceId: tx.traceId,
        durationMs,
        status,
        environment: options.environment,
        spans: tx.spans.map((s) => ({
          spanId: s.spanId,
          op: s.op,
          description: s.description,
          durationMs: Math.round(performance.now() - s.startTime),
          parentSpanId: s.parentSpanId,
        })),
        timestamp: new Date().toISOString(),
      };
      transport.enqueue(item);
      activeSpans.clear();
    },
    startChild(op: string, description?: string): SpanHandle {
      const spanId = randomId();
      const span: ActiveSpan = {
        spanId,
        op,
        description,
        startTime: performance.now(),
        parentSpanId: tx.rootSpanId,
      };
      tx.spans.push(span);
      activeSpans.set(spanId, span);

      return {
        finish() {
          const active = activeSpans.get(spanId);
          if (active) {
            activeSpans.delete(spanId);
          }
        },
      };
    },
  };
}

export async function flush(): Promise<void> {
  await transport?.flush();
}

function installGlobalHandlers(): void {
  if (globalHandlersInstalled) return;
  globalHandlersInstalled = true;

  if (typeof window !== "undefined") {
    window.addEventListener("error", (event: ErrorEvent) => {
      captureException(event.error ?? new Error(event.message));
    });
    window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
      captureException(event.reason);
    });
  }

  if (typeof process !== "undefined") {
    process.on("uncaughtException", (err) => {
      captureException(err);
    });
    process.on("unhandledRejection", (reason) => {
      captureException(reason);
    });
  }
}

function installNodeExitHandler(): void {
  if (typeof process === "undefined") return;
  process.on("beforeExit", () => {
    void flush();
  });
}

export { parseDsn } from "./utils.js";
export type { SdkOptions, Breadcrumb } from "./utils.js";
export type {
  IngestItem,
  ErrorIngestItem,
  TransactionIngestItem,
  StackFrame,
  SpanPayload,
} from "./ingest-types.js";
