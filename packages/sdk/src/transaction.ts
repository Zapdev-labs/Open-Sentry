import { randomId } from "./utils.js";
import type { ActiveSpan, ActiveTransaction, SpanPayload } from "./types.js";

const now = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

export function createTransaction(
  name: string,
  onFinish: (payload: {
    name: string;
    traceId: string;
    durationMs: number;
    status: string;
    spans: SpanPayload[];
  }) => void
): ActiveTransaction {
  const traceId = randomId();
  const startTime = now();
  const spans: SpanPayload[] = [];

  const startChild = (op: string, description?: string): ActiveSpan => {
    const spanId = randomId();
    const spanStart = now();

    return {
      spanId,
      finish: () => {
        spans.push({
          spanId,
          op,
          description,
          durationMs: Math.round(now() - spanStart),
        });
      },
    };
  };

  return {
    name,
    traceId,
    startTime,
    spans,
    startChild,
    finish: (status = "ok") => {
      onFinish({
        name,
        traceId,
        durationMs: Math.round(now() - startTime),
        status,
        spans,
      });
    },
  };
}
