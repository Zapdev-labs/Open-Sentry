import { Worker } from "bullmq";
import { processBatch, type IngestJobData } from "./processor";

const INGEST_QUEUE = "ingest-events";
const BATCH_SIZE = 50;
const BATCH_WAIT_MS = 100;

function getRedisConnection(): { host: string; port: number; password?: string } {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
  };
}

let pending: IngestJobData[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flushBatch(): Promise<void> {
  if (pending.length === 0) return;
  const batch = pending.splice(0, BATCH_SIZE);
  await processBatch(batch);
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushBatch().catch((error: unknown) => {
      console.error("Batch processing failed:", error);
    });
  }, BATCH_WAIT_MS);
}

const worker = new Worker<IngestJobData>(
  INGEST_QUEUE,
  async (job) => {
    pending.push(job.data);
    if (pending.length >= BATCH_SIZE) {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      await flushBatch();
    } else {
      scheduleFlush();
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 5,
  }
);

worker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error);
});

worker.on("ready", () => {
  console.log("Worker ready, consuming ingest-events queue");
});

process.on("SIGTERM", async () => {
  await flushBatch();
  await worker.close();
});

process.on("SIGINT", async () => {
  await flushBatch();
  await worker.close();
  process.exit(0);
});
