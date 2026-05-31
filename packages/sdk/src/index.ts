import type { IngestItem } from "./ingest-types.js";
import {
  randomId,
  parseStack,
  levelFromExceptionType,
  type Breadcrumb,
  type SdkOptions,
} from "./utils.js";
import { getScope, setUser, setTag, setTags, clearScope } from "./scope.js";
import { installBreadcrumbIntegrations } from "./integrations.js";
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
let options: Required<
  Pick<SdkOptions, "environment" | "release" | "sampleRate" | "tracesSampleRate" | "maxBreadcrumbs" | "enableBreadcrumbs">
> = {
  environment: "production",
  release: "unknown",
  sampleRate: 1.0,
  tracesSampleRate: 0.1,
  maxBreadcrumbs: 50,
  enableBreadcrumbs: true,
};
const breadcrumbs: Breadcrumb[] = [];
let globalHandlersInstalled = false;
let integrationsInstalled = false;

export function init(opts: SdkOptions): void {
  if (!opts.dsn) throw new Error("DSN is required");
  transport = new Transport(opts.dsn);
  options = {
    environment: opts.environment ?? "production",
    release: opts.release ?? "unknown",
    sampleRate: opts.sampleRate ?? 1.0,
    tracesSampleRate: opts.tracesSampleRate ?? 0.1,
    maxBreadcrumbs: opts.maxBreadcrumbs ?? 50,
    enableBreadcrumbs: opts.enableBreadcrumbs ?? true,
  };
  installGlobalHandlers();
  installNodeExitHandler();
  if (options.enableBreadcrumbs) {
    installIntegrations();
  }
}

function installIntegrations(): void {
  if (integrationsInstalled) return;
  integrationsInstalled = true;
  installBreadcrumbIntegrations(addBreadcrumb);
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

function buildErrorItem(
  exception: {
    type?: string;
    value?: string;
    stacktrace?: { frames?: ReturnType<typeof parseStack> };
  },
  level?: "fatal" | "error" | "warning" | "info" | "debug"
): Extract<IngestItem, { type: "error" }> {
  const scope = getScope();
  return {
    type: "error",
    exception,
    level: level ?? levelFromExceptionType(exception.type),
    breadcrumbs: [...breadcrumbs],
    tags: Object.keys(scope.tags).length > 0 ? scope.tags : undefined,
    user: scope.user
      ? Object.fromEntries(
          Object.entries(scope.user).filter((entry): entry is [string, string] => entry[1] != null)
        )
      : undefined,
    environment: options.environment,
    release: options.release,
    timestamp: new Date().toISOString(),
  };
}

export function captureException(error: unknown): void {
  if (!transport) return;
  if (Math.random() > options.sampleRate) return;

  const err = error instanceof Error ? error : new Error(String(error));
  const item = buildErrorItem({
    type: err.name,
    value: err.message,
    stacktrace: { frames: parseStack(err) },
  });
  transport.enqueue(item);
}

export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info"
): void {
  if (!transport) return;
  if (Math.random() > options.sampleRate) return;

  const item = buildErrorItem(
    {
      type: level,
      value: message,
    },
    level
  );
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
          activeSpans.delete(spanId);
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
export { setUser, setTag, setTags, clearScope } from "./scope.js";
export type { SdkOptions, Breadcrumb } from "./utils.js";
export type { UserContext } from "./scope.js";
export type {
  IngestItem,
  ErrorIngestItem,
  TransactionIngestItem,
  StackFrame,
  SpanPayload,
} from "./ingest-types.js";
