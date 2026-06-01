import { and, desc, eq, isNull } from "drizzle-orm";
import {
  getDb,
  uptimeMonitors,
  uptimeChecks,
  uptimeIncidents,
  evaluateCheck,
  isExpectedResponse,
  type ProbeResult,
  type UptimeMonitor,
} from "@sentry-clone/db";

// How often the scheduler wakes up to look for monitors that are due. Individual
// monitors are still only probed every `intervalSeconds`; this is just the
// granularity of the scheduler loop.
const TICK_MS = 5000;

async function probe(monitor: UptimeMonitor): Promise<ProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), monitor.timeoutMs);
  const start = Date.now();
  try {
    const response = await fetch(monitor.url, {
      method: monitor.method,
      headers: monitor.headers,
      signal: controller.signal,
      redirect: "follow",
    });
    const responseMs = Date.now() - start;
    const ok = isExpectedResponse(monitor.expectedStatus, response.status, false);
    return {
      ok,
      httpStatus: response.status,
      responseMs,
      error: ok ? undefined : `Expected ${monitor.expectedStatus}, got ${response.status}`,
    };
  } catch (err) {
    const responseMs = Date.now() - start;
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      responseMs,
      error: aborted
        ? `Timed out after ${monitor.timeoutMs}ms`
        : err instanceof Error
          ? err.message
          : "Request failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runCheck(monitor: UptimeMonitor): Promise<void> {
  const db = getDb();
  const result = await probe(monitor);
  const evaluated = evaluateCheck(
    {
      currentStatus: monitor.currentStatus,
      consecutiveFailures: monitor.consecutiveFailures,
      failureThreshold: monitor.failureThreshold,
    },
    result
  );

  await db.insert(uptimeChecks).values({
    monitorId: monitor.id,
    status: evaluated.checkStatus,
    httpStatus: result.httpStatus ?? null,
    responseMs: result.responseMs ?? null,
    error: result.error ?? null,
  });

  await db
    .update(uptimeMonitors)
    .set({
      currentStatus: evaluated.status,
      consecutiveFailures: evaluated.consecutiveFailures,
      lastCheckedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(uptimeMonitors.id, monitor.id));

  if (evaluated.transition.type === "open-incident") {
    await db
      .insert(uptimeIncidents)
      .values({ monitorId: monitor.id, cause: evaluated.transition.cause });
    console.log(`[uptime] ${monitor.name} is DOWN: ${evaluated.transition.cause}`);
  } else if (evaluated.transition.type === "resolve-incident") {
    const [open] = await db
      .select()
      .from(uptimeIncidents)
      .where(and(eq(uptimeIncidents.monitorId, monitor.id), isNull(uptimeIncidents.resolvedAt)))
      .orderBy(desc(uptimeIncidents.startedAt))
      .limit(1);
    if (open) {
      await db
        .update(uptimeIncidents)
        .set({ resolvedAt: new Date() })
        .where(eq(uptimeIncidents.id, open.id));
    }
    console.log(`[uptime] ${monitor.name} recovered`);
  }
}

function isDue(monitor: UptimeMonitor, now: number): boolean {
  if (!monitor.lastCheckedAt) return true;
  const elapsed = now - new Date(monitor.lastCheckedAt).getTime();
  return elapsed >= monitor.intervalSeconds * 1000;
}

/**
 * Starts the uptime scheduler loop. Probes run concurrently but a single
 * monitor is never probed twice at once. Returns a stop function.
 */
export function startUptimeScheduler(): () => void {
  const inFlight = new Set<string>();

  async function tick(): Promise<void> {
    const db = getDb();
    const now = Date.now();
    const monitors = await db
      .select()
      .from(uptimeMonitors)
      .where(eq(uptimeMonitors.enabled, true));

    for (const monitor of monitors) {
      if (inFlight.has(monitor.id) || !isDue(monitor, now)) continue;
      inFlight.add(monitor.id);
      void runCheck(monitor)
        .catch((err: unknown) => console.error(`[uptime] check failed for ${monitor.name}:`, err))
        .finally(() => inFlight.delete(monitor.id));
    }
  }

  const timer = setInterval(() => {
    void tick().catch((err: unknown) => console.error("[uptime] scheduler tick failed:", err));
  }, TICK_MS);

  void tick();
  console.log("Uptime scheduler started");
  return () => clearInterval(timer);
}
