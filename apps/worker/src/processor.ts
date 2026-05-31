import { sql } from "drizzle-orm";
import {
  createDb,
  computeFingerprint,
  normalizeStackFrames,
  issues,
  events,
  transactions,
  spans,
  type IngestItem,
  type Database,
} from "@sentry-clone/db";

export interface IngestJobData {
  projectId: string;
  payload: IngestItem;
  receivedAt: string;
}

export async function processBatch(jobs: IngestJobData[]): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const { db } = createDb(url, 10);

  await db.transaction(async (tx) => {
    for (const job of jobs) {
      const item = job.payload;
      if (item.type === "error") {
        await processError(tx, job.projectId, item, job.receivedAt);
      } else {
        await processTransaction(tx, job.projectId, item, job.receivedAt);
      }
    }
  });
}

type TxClient = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function processError(
  tx: TxClient,
  projectId: string,
  item: Extract<IngestItem, { type: "error" }>,
  receivedAt: string
): Promise<void> {
  const { fingerprint, title, level } = computeFingerprint(item.exception, item.message);
  const now = item.timestamp ? new Date(item.timestamp) : new Date(receivedAt);
  const stackFrames = normalizeStackFrames(item.exception.stacktrace?.frames);
  const message = item.exception.value ?? item.message ?? "Unknown error";

  const [issue] = await tx
    .insert(issues)
    .values({
      projectId,
      fingerprint,
      title,
      level: level as "error",
      firstSeen: now,
      lastSeen: now,
      eventCount: 1,
    })
    .onConflictDoUpdate({
      target: [issues.projectId, issues.fingerprint],
      set: {
        lastSeen: now,
        eventCount: sql`${issues.eventCount} + 1`,
      },
    })
    .returning({ id: issues.id });

  if (!issue) return;

  await tx.insert(events).values({
    issueId: issue.id,
    projectId,
    message,
    stack: stackFrames,
    breadcrumbs: item.breadcrumbs ?? [],
    tags: item.tags ?? {},
    user: item.user,
    environment: item.environment,
    release: item.release,
    timestamp: now,
  });
}

async function processTransaction(
  tx: TxClient,
  projectId: string,
  item: Extract<IngestItem, { type: "transaction" }>,
  receivedAt: string
): Promise<void> {
  const now = item.timestamp ? new Date(item.timestamp) : new Date(receivedAt);

  const [transaction] = await tx
    .insert(transactions)
    .values({
      projectId,
      name: item.name,
      traceId: item.traceId,
      durationMs: item.durationMs,
      status: item.status ?? "ok",
      environment: item.environment,
      timestamp: now,
    })
    .returning({ id: transactions.id });

  if (!transaction || !item.spans?.length) return;

  await tx.insert(spans).values(
    item.spans.map((span: NonNullable<typeof item.spans>[number]) => ({
      transactionId: transaction.id,
      spanId: span.spanId,
      op: span.op,
      description: span.description,
      durationMs: span.durationMs,
      parentSpanId: span.parentSpanId,
    }))
  );
}
