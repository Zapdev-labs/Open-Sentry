import { z } from "zod";

const stackFrameSchema = z.object({
  filename: z.string().optional(),
  function: z.string().optional(),
  lineno: z.number().optional(),
  colno: z.number().optional(),
  inApp: z.boolean().optional(),
});

const breadcrumbSchema = z.object({
  category: z.string().optional(),
  message: z.string().optional(),
  level: z.string().optional(),
  timestamp: z.string().optional(),
});

const spanSchema = z.object({
  spanId: z.string(),
  op: z.string(),
  description: z.string().optional(),
  durationMs: z.number(),
  parentSpanId: z.string().optional(),
});

export const errorPayloadSchema = z.object({
  type: z.literal("error"),
  exception: z.object({
    type: z.string().optional(),
    value: z.string().optional(),
    stacktrace: z
      .object({
        frames: z.array(stackFrameSchema).optional(),
      })
      .optional(),
  }),
  message: z.string().optional(),
  breadcrumbs: z.array(breadcrumbSchema).optional(),
  tags: z.record(z.string()).optional(),
  user: z.record(z.string()).optional(),
  environment: z.string().optional(),
  release: z.string().optional(),
  timestamp: z.string().optional(),
});

export const transactionPayloadSchema = z.object({
  type: z.literal("transaction"),
  name: z.string(),
  traceId: z.string(),
  durationMs: z.number(),
  status: z.enum(["ok", "error", "cancelled"]).optional(),
  spans: z.array(spanSchema).optional(),
  environment: z.string().optional(),
  timestamp: z.string().optional(),
});

export const ingestItemSchema = z.discriminatedUnion("type", [
  errorPayloadSchema,
  transactionPayloadSchema,
]);

export const ingestPayloadSchema = z.union([
  ingestItemSchema,
  z.array(ingestItemSchema).min(1).max(20),
]);

export type IngestItem = z.infer<typeof ingestItemSchema>;
export type IngestPayload = z.infer<typeof ingestPayloadSchema>;

export function normalizePayload(payload: IngestPayload): IngestItem[] {
  return Array.isArray(payload) ? payload : [payload];
}

export const MAX_BODY_BYTES = 256 * 1024;
