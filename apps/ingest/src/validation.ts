import {
  ingestPayloadSchema,
  normalizePayload,
  type IngestItem,
  type IngestPayload,
} from "@sentry-clone/db";

export {
  ingestPayloadSchema,
  ingestItemSchema,
  errorPayloadSchema,
  transactionPayloadSchema,
  normalizePayload,
  MAX_BODY_BYTES,
  type IngestItem,
  type IngestPayload,
} from "@sentry-clone/db";

export type ValidatedIngestItem = IngestItem;

export function normalizeBatch(body: unknown): ValidatedIngestItem[] {
  const result = ingestPayloadSchema.safeParse(body);
  if (!result.success) {
    throw new Error("Invalid payload");
  }
  return normalizePayload(result.data);
}
