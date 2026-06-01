import { and, eq, sql } from "drizzle-orm";
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
  releases,
  releaseIssueFirstSeen,
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

  // Pre-query: capture the prior issue state so we can detect regressions and
  // decide whether this is a brand-new issue (first-seen-in-release wiring).
  const priorRows = await tx
    .select({
      id: issues.id,
      status: issues.status,
      resolvedAt: issues.resolvedAt,
      firstRelease: issues.firstRelease,
      regressionOf: issues.regressionOf,
    })
    .from(issues)
    .where(and(eq(issues.projectId, projectId), eq(issues.fingerprint, fingerprint)))
    .limit(1);
  const prior = priorRows[0] ?? null;
  const isNewIssue = prior === null;
  const wasResolved = prior?.resolvedAt != null;

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

  // Wire up release tracking (first-seen, last-seen, regression detection).
  // All of this is best-effort — the release may not exist yet in our system
  // (the user might not have created it), or this issue may have arrived
  // without a release tag. We never fail the ingest because of release work.
  if (item.release) {
    const releaseRows = await tx
      .select({ id: releases.id, version: releases.version })
      .from(releases)
      .where(
        and(eq(releases.projectId, projectId), eq(releases.version, item.release))
      )
      .limit(1);
    const release = releaseRows[0] ?? null;

    if (release) {
      const releasePatch: {
        lastRelease: string;
        firstRelease?: string;
      } = { lastRelease: release.version };
      if (isNewIssue || !prior?.firstRelease) {
        releasePatch.firstRelease = release.version;
      }

      await tx
        .update(issues)
        .set(releasePatch)
        .where(eq(issues.id, issue.id));

      // For new issues, also record the explicit first-seen-in-release link so
      // the release detail page can show a fast "X new issues" count without
      // having to re-join the issues table on first_release.
      if (isNewIssue) {
        await tx
          .insert(releaseIssueFirstSeen)
          .values({
            projectId,
            releaseId: release.id,
            issueId: issue.id,
          })
          .onConflictDoNothing();
      }
    }
  }

  // Regression detection: a previously-resolved issue just received a new
  // event. Reopen it and stamp a self-referencing regressionOf marker so the
  // dashboard can badge it as a regression.
  if (wasResolved && !isNewIssue) {
    await tx
      .update(issues)
      .set({
        status: "open",
        resolvedAt: null,
        resolvedBy: null,
        regressionOf: issue.id,
      })
      .where(eq(issues.id, issue.id));
  }

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
      release: item.release,
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
