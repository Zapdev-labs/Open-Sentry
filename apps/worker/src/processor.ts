import { sql } from "drizzle-orm";
import {
  createDb,
  computeFingerprint,
  normalizeStackFrames,
  normalizeBreadcrumbs,
  issues,
  events,
  transactions,
  spans,
  aiGenerations,
  type IngestItem,
  type Database,
} from "@sentry-clone/db";
import {
  syncNewIssuesToIntegrations,
  type NewIssueForIntegration,
} from "@sentry-clone/integrations";

export interface IngestJobData {
  projectId: string;
  payload: IngestItem;
  receivedAt: string;
}

export async function processBatch(jobs: IngestJobData[]): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const { db } = createDb(url, 10);
  const newIssues: NewIssueForIntegration[] = [];

  await db.transaction(async (tx) => {
    for (const job of jobs) {
      const item = job.payload;
      if (item.type === "error") {
        const created = await processError(tx, job.projectId, item, job.receivedAt);
        if (created) newIssues.push(created);
      } else if (item.type === "transaction") {
        await processTransaction(tx, job.projectId, item, job.receivedAt);
      } else {
        await processAiGeneration(tx, job.projectId, item, job.receivedAt);
      }
    }
  });

  await syncNewIssuesToIntegrations(db, newIssues);
}

type TxClient = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function processError(
  tx: TxClient,
  projectId: string,
  item: Extract<IngestItem, { type: "error" }>,
  receivedAt: string
): Promise<NewIssueForIntegration | null> {
  const { fingerprint, title, level } = computeFingerprint(
    item.exception,
    item.message,
    item.level
  );
  const now = item.timestamp ? new Date(item.timestamp) : new Date(receivedAt);
  const stackFrames = normalizeStackFrames(item.exception.stacktrace?.frames);
  const breadcrumbList = normalizeBreadcrumbs(item.breadcrumbs);
  const message = item.exception.value ?? item.message ?? "Unknown error";

  const [issue] = await tx
    .insert(issues)
    .values({
      projectId,
      fingerprint,
      title,
      level,
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
    .returning({
      id: issues.id,
      eventCount: issues.eventCount,
      title: issues.title,
    });

  if (!issue) return null;

  await tx.insert(events).values({
    issueId: issue.id,
    projectId,
    message,
    stack: stackFrames,
    breadcrumbs: breadcrumbList,
    tags: item.tags ?? {},
    user: item.user,
    environment: item.environment,
    release: item.release,
    timestamp: now,
  });

  if (issue.eventCount !== 1) return null;

  return {
    issueId: issue.id,
    projectId,
    title: issue.title,
    message,
    level,
    environment: item.environment,
    release: item.release,
  };
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

async function processAiGeneration(
  tx: TxClient,
  projectId: string,
  item: Extract<IngestItem, { type: "ai_generation" }>,
  receivedAt: string
): Promise<void> {
  const now = item.timestamp ? new Date(item.timestamp) : new Date(receivedAt);
  const outputTokens = item.outputTokens ?? 0;
  const totalTokens = item.totalTokens ?? item.inputTokens + outputTokens;

  await tx.insert(aiGenerations).values({
    projectId,
    traceId: item.traceId,
    spanId: item.spanId,
    provider: item.provider,
    model: item.model,
    inputTokens: item.inputTokens,
    outputTokens,
    totalTokens,
    cachedInputTokens: item.cachedInputTokens ?? 0,
    cacheWriteTokens: item.cacheWriteTokens ?? 0,
    inputCostUsd: item.inputCostUsd?.toString(),
    outputCostUsd: item.outputCostUsd?.toString(),
    totalCostUsd: item.totalCostUsd?.toString(),
    latencyMs: item.latencyMs,
    timeToFirstTokenMs: item.timeToFirstTokenMs,
    status: item.status ?? "ok",
    tags: item.tags ?? {},
    user: item.user,
    metadata: item.metadata,
    environment: item.environment,
    release: item.release,
    timestamp: now,
  });
}
