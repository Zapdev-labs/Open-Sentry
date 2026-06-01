import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const issueStatusEnum = pgEnum("issue_status", ["open", "resolved", "ignored"]);
export const issueLevelEnum = pgEnum("issue_level", ["fatal", "error", "warning", "info", "debug"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["ok", "error", "cancelled"]);
export const aiGenerationStatusEnum = pgEnum("ai_generation_status", ["ok", "error"]);
export const integrationProviderEnum = pgEnum("integration_provider", [
  "linear",
  "slack",
  "discord",
  "msteams",
  "pagerduty",
  "webhook",
  "email",
]);
export const uptimeMonitorStatusEnum = pgEnum("uptime_monitor_status", [
  "up",
  "down",
  "paused",
  "unknown",
]);
export const uptimeCheckStatusEnum = pgEnum("uptime_check_status", ["up", "down"]);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    name: text("name").notNull(),
    publicKey: text("public_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("projects_public_key_idx").on(table.publicKey),
    index("projects_organization_id_idx").on(table.organizationId),
  ]
);

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    title: text("title").notNull(),
    level: issueLevelEnum("level").notNull().default("error"),
    status: issueStatusEnum("status").notNull().default("open"),
    firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
    lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
    eventCount: integer("event_count").notNull().default(1),
    firstRelease: text("first_release"),
    lastRelease: text("last_release"),
    regressionOf: uuid("regression_of"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by"),
  },
  (table) => [
    uniqueIndex("issues_project_fingerprint_idx").on(table.projectId, table.fingerprint),
    index("issues_project_status_last_seen_idx").on(table.projectId, table.status, table.lastSeen),
    index("issues_open_partial_idx")
      .on(table.projectId, table.lastSeen)
      .where(sql`${table.status} = 'open'`),
    index("issues_first_release_idx").on(table.projectId, table.firstRelease),
  ]
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    stack: jsonb("stack").$type<StackFrame[]>().notNull().default([]),
    breadcrumbs: jsonb("breadcrumbs").$type<Breadcrumb[]>().notNull().default([]),
    tags: jsonb("tags").$type<Record<string, string>>().notNull().default({}),
    user: jsonb("user").$type<Record<string, string>>(),
    environment: text("environment"),
    release: text("release"),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("events_issue_timestamp_idx").on(table.issueId, table.timestamp),
    index("events_project_timestamp_idx").on(table.projectId, table.timestamp),
  ]
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    traceId: text("trace_id").notNull(),
    durationMs: integer("duration_ms").notNull(),
    status: transactionStatusEnum("status").notNull().default("ok"),
    environment: text("environment"),
    release: text("release"),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("transactions_project_timestamp_idx").on(table.projectId, table.timestamp),
    index("transactions_trace_id_idx").on(table.traceId),
    index("transactions_project_release_idx").on(table.projectId, table.release),
  ]
);

export const spans = pgTable(
  "spans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    spanId: text("span_id").notNull(),
    op: text("op").notNull(),
    description: text("description"),
    durationMs: integer("duration_ms").notNull(),
    parentSpanId: text("parent_span_id"),
  },
  (table) => [index("spans_transaction_id_idx").on(table.transactionId)]
);

export const projectIntegrations = pgTable(
  "project_integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    provider: integrationProviderEnum("provider").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("project_integrations_project_provider_idx").on(table.projectId, table.provider),
  ]
);

export const issueExternalLinks = pgTable(
  "issue_external_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    provider: integrationProviderEnum("provider").notNull(),
    externalId: text("external_id").notNull(),
    externalUrl: text("external_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("issue_external_links_issue_provider_idx").on(table.issueId, table.provider),
  ]
);

export const aiGenerations = pgTable(
  "ai_generations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    traceId: text("trace_id"),
    spanId: text("span_id"),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    inputCostUsd: text("input_cost_usd"),
    outputCostUsd: text("output_cost_usd"),
    totalCostUsd: text("total_cost_usd"),
    latencyMs: integer("latency_ms"),
    timeToFirstTokenMs: integer("time_to_first_token_ms"),
    status: aiGenerationStatusEnum("status").notNull().default("ok"),
    tags: jsonb("tags").$type<Record<string, string>>().notNull().default({}),
    user: jsonb("user").$type<Record<string, string>>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    environment: text("environment"),
    release: text("release"),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_generations_project_timestamp_idx").on(table.projectId, table.timestamp),
    index("ai_generations_project_model_idx").on(table.projectId, table.model),
    index("ai_generations_project_provider_idx").on(table.projectId, table.provider),
  ]
);

export const uptimeMonitors = pgTable(
  "uptime_monitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    method: text("method").notNull().default("GET"),
    intervalSeconds: integer("interval_seconds").notNull().default(60),
    timeoutMs: integer("timeout_ms").notNull().default(10000),
    expectedStatus: integer("expected_status").notNull().default(200),
    failureThreshold: integer("failure_threshold").notNull().default(2),
    headers: jsonb("headers").$type<Record<string, string>>().notNull().default({}),
    enabled: boolean("enabled").notNull().default(true),
    currentStatus: uptimeMonitorStatusEnum("current_status").notNull().default("unknown"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("uptime_monitors_project_id_idx").on(table.projectId)]
);

export const uptimeChecks = pgTable(
  "uptime_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    monitorId: uuid("monitor_id")
      .notNull()
      .references(() => uptimeMonitors.id, { onDelete: "cascade" }),
    status: uptimeCheckStatusEnum("status").notNull(),
    httpStatus: integer("http_status"),
    responseMs: integer("response_ms"),
    error: text("error"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("uptime_checks_monitor_checked_at_idx").on(table.monitorId, table.checkedAt)]
);

export const uptimeIncidents = pgTable(
  "uptime_incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    monitorId: uuid("monitor_id")
      .notNull()
      .references(() => uptimeMonitors.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    cause: text("cause"),
  },
  (table) => [index("uptime_incidents_monitor_started_at_idx").on(table.monitorId, table.startedAt)]
);

export interface StackFrame {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  inApp?: boolean;
  module?: string;
  absPath?: string;
  contextLine?: string;
  preContext?: string[];
  postContext?: string[];
}

export interface Breadcrumb {
  category?: string;
  message?: string;
  level?: string;
  timestamp?: string;
  type?: string;
  data?: Record<string, unknown>;
}

export type Project = typeof projects.$inferSelect;
export type Issue = typeof issues.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Span = typeof spans.$inferSelect;
export type AiGeneration = typeof aiGenerations.$inferSelect;
export type ProjectIntegration = typeof projectIntegrations.$inferSelect;
export type IssueExternalLink = typeof issueExternalLinks.$inferSelect;
export type UptimeMonitor = typeof uptimeMonitors.$inferSelect;
export type UptimeCheck = typeof uptimeChecks.$inferSelect;
export type UptimeIncident = typeof uptimeIncidents.$inferSelect;
