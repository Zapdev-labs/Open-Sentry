import { Queue } from "bullmq";
import { randomUUID } from "node:crypto";
import type { ValidatedIngestItem } from "./validation.js";

export const INGEST_QUEUE = "ingest-events";

function getRedisConnection(): { host: string; port: number; password?: string; maxRetriesPerRequest: null } {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    maxRetriesPerRequest: null,
  };
}

const queue = new Queue(INGEST_QUEUE, {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export type IngestJobData = {
  projectId: string;
  payload: ValidatedIngestItem;
  receivedAt: string;
};

export async function warmQueue(): Promise<void> {
  await queue.waitUntilReady();
}

export async function enqueueIngestBatch(
  projectId: string,
  items: ValidatedIngestItem[]
): Promise<string> {
  const batchId = randomUUID();
  const receivedAt = new Date().toISOString();

  if (items.length === 1) {
    const payload = items[0];
    if (!payload) return batchId;
    await queue.add("ingest", { projectId, payload, receivedAt } satisfies IngestJobData, {
      jobId: batchId,
    });
    return batchId;
  }

  await queue.addBulk(
    items.map((payload, index) => ({
      name: "ingest",
      data: { projectId, payload, receivedAt } satisfies IngestJobData,
      opts: { jobId: `${batchId}-${index}` },
    }))
  );

  return batchId;
}
