import {
  getDb,
  uptimeMonitors,
  uptimeChecks,
  uptimeIncidents,
  computeUptimePercentage,
  averageResponseMs,
  type UptimeMonitor,
  type UptimeIncident,
} from "@sentry-clone/db";
import { and, asc, desc, eq, gte, inArray, isNull } from "drizzle-orm";

function db() {
  return getDb();
}

const DAY_MS = 24 * 60 * 60 * 1000;
const STRIP_LENGTH = 40;

export interface MonitorSummary {
  monitor: UptimeMonitor;
  uptime24h: number;
  avgResponseMs: number | null;
  checkCount: number;
  recentChecks: { status: "up" | "down"; checkedAt: Date }[];
  openIncident: UptimeIncident | null;
}

export interface CreateMonitorInput {
  name: string;
  url: string;
  method?: string;
  intervalSeconds?: number;
  timeoutMs?: number;
  expectedStatus?: number;
  failureThreshold?: number;
  headers?: Record<string, string>;
}

export async function getMonitorSummaries(projectId: string): Promise<MonitorSummary[]> {
  const monitors = await db()
    .select()
    .from(uptimeMonitors)
    .where(eq(uptimeMonitors.projectId, projectId))
    .orderBy(asc(uptimeMonitors.createdAt));

  if (monitors.length === 0) return [];

  const monitorIds = monitors.map((m) => m.id);
  const since = new Date(Date.now() - DAY_MS);

  const [checks, openIncidents] = await Promise.all([
    db()
      .select({
        monitorId: uptimeChecks.monitorId,
        status: uptimeChecks.status,
        responseMs: uptimeChecks.responseMs,
        checkedAt: uptimeChecks.checkedAt,
      })
      .from(uptimeChecks)
      .where(and(inArray(uptimeChecks.monitorId, monitorIds), gte(uptimeChecks.checkedAt, since)))
      .orderBy(asc(uptimeChecks.checkedAt)),
    db()
      .select()
      .from(uptimeIncidents)
      .where(and(inArray(uptimeIncidents.monitorId, monitorIds), isNull(uptimeIncidents.resolvedAt))),
  ]);

  const checksByMonitor = new Map<string, typeof checks>();
  for (const check of checks) {
    const list = checksByMonitor.get(check.monitorId) ?? [];
    list.push(check);
    checksByMonitor.set(check.monitorId, list);
  }

  const incidentByMonitor = new Map<string, UptimeIncident>();
  for (const incident of openIncidents) {
    incidentByMonitor.set(incident.monitorId, incident);
  }

  return monitors.map((monitor) => {
    const monitorChecks = checksByMonitor.get(monitor.id) ?? [];
    return {
      monitor,
      uptime24h: computeUptimePercentage(monitorChecks),
      avgResponseMs: averageResponseMs(monitorChecks),
      checkCount: monitorChecks.length,
      recentChecks: monitorChecks
        .slice(-STRIP_LENGTH)
        .map((c) => ({ status: c.status, checkedAt: c.checkedAt })),
      openIncident: incidentByMonitor.get(monitor.id) ?? null,
    };
  });
}

export async function createUptimeMonitor(
  projectId: string,
  input: CreateMonitorInput
): Promise<UptimeMonitor> {
  const [monitor] = await db()
    .insert(uptimeMonitors)
    .values({
      projectId,
      name: input.name,
      url: input.url,
      method: input.method ?? "GET",
      intervalSeconds: input.intervalSeconds ?? 60,
      timeoutMs: input.timeoutMs ?? 10000,
      expectedStatus: input.expectedStatus ?? 200,
      failureThreshold: input.failureThreshold ?? 2,
      headers: input.headers ?? {},
    })
    .returning();
  return monitor!;
}

export async function deleteUptimeMonitor(projectId: string, monitorId: string): Promise<boolean> {
  const deleted = await db()
    .delete(uptimeMonitors)
    .where(and(eq(uptimeMonitors.id, monitorId), eq(uptimeMonitors.projectId, projectId)))
    .returning({ id: uptimeMonitors.id });
  return deleted.length > 0;
}

export async function getRecentIncidents(
  projectId: string,
  monitorIds: string[],
  limit = 10
): Promise<UptimeIncident[]> {
  if (monitorIds.length === 0) return [];
  return db()
    .select()
    .from(uptimeIncidents)
    .where(inArray(uptimeIncidents.monitorId, monitorIds))
    .orderBy(desc(uptimeIncidents.startedAt))
    .limit(limit);
}
