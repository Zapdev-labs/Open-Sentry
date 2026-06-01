import { sql } from "drizzle-orm";
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
import { projects, issues, uptimeMonitors } from "./schema";

export const apiTokenScopeEnum = pgEnum("api_token_scope", ["read", "write", "admin"]);
export const dsnEnvironmentEnum = pgEnum("dsn_environment", [
  "production",
  "staging",
  "development",
  "test",
  "custom",
]);
export const ssoProviderTypeEnum = pgEnum("sso_provider_type", ["saml", "oidc"]);
export const scimTokenStatusEnum = pgEnum("scim_token_status", ["active", "revoked"]);
export const auditActionEnum = pgEnum("audit_action", [
  "member.invited",
  "member.removed",
  "member.role_changed",
  "project.created",
  "project.deleted",
  "project.settings_updated",
  "api_token.created",
  "api_token.revoked",
  "dsn.created",
  "dsn.revoked",
  "sso.configured",
  "sso.disabled",
  "scim.token_created",
  "scim.token_revoked",
  "release.created",
  "alert_rule.created",
  "alert_rule.updated",
  "alert_rule.deleted",
  "alert_channel.created",
  "alert_channel.updated",
  "alert_channel.deleted",
  "retention.updated",
  "data.exported",
]);
export const alertRuleTypeEnum = pgEnum("alert_rule_type", [
  "issue.count_threshold",
  "issue.new",
  "issue.regression",
  "issue.frequency_spike",
  "transaction.error_rate",
  "transaction.p95_latency",
  "uptime.down",
  "uptime.recovered",
]);
export const alertChannelTypeEnum = pgEnum("alert_channel_type", [
  "slack",
  "webhook",
  "email",
  "pagerduty",
  "discord",
  "msteams",
]);
export const alertDeliveryStatusEnum = pgEnum("alert_delivery_status", [
  "pending",
  "delivered",
  "failed",
  "rate_limited",
]);
export const releaseStatusEnum = pgEnum("release_status", [
  "open",
  "shipped",
  "archived",
]);
export const retentionDataTypeEnum = pgEnum("retention_data_type", [
  "events",
  "transactions",
  "spans",
  "ai_generations",
  "uptime_checks",
  "all",
]);

// --- API Tokens (org or project-scoped) -------------------------------------

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    lastFour: text("last_four").notNull(),
    scope: apiTokenScopeEnum("scope").notNull().default("read"),
    createdBy: text("created_by").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("api_tokens_token_hash_idx").on(table.tokenHash),
    index("api_tokens_organization_id_idx").on(table.organizationId),
    index("api_tokens_project_id_idx").on(table.projectId),
  ]
);

// --- DSN Keys (multiple DSNs per project, one per environment) ---------------

export const dsnKeys = pgTable(
  "dsn_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    publicKey: text("public_key").notNull(),
    environment: dsnEnvironmentEnum("environment").notNull().default("production"),
    label: text("label"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdBy: text("created_by").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("dsn_keys_public_key_idx").on(table.publicKey),
    index("dsn_keys_project_id_idx").on(table.projectId),
    uniqueIndex("dsn_keys_project_environment_idx")
      .on(table.projectId, table.environment)
      .where(sql`${table.revokedAt} IS NULL`),
  ]
);

// --- Audit Log --------------------------------------------------------------

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    actorId: text("actor_id"),
    actorEmail: text("actor_email"),
    action: auditActionEnum("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    targetLabel: text("target_label"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_log_organization_created_idx").on(table.organizationId, table.createdAt),
    index("audit_log_organization_action_idx").on(table.organizationId, table.action),
    index("audit_log_actor_idx").on(table.actorId),
  ]
);

// --- SSO Connections (SAML or OIDC, per organization) -----------------------

export const ssoConnections = pgTable(
  "sso_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    providerType: ssoProviderTypeEnum("provider_type").notNull(),
    providerName: text("provider_name").notNull(),
    emailDomains: text("email_domains").array().notNull().default(sql`ARRAY[]::text[]`),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sso_connections_organization_idx").on(table.organizationId)]
);

// --- SCIM Tokens (provisioning tokens for IdPs) -----------------------------

export const scimTokens = pgTable(
  "scim_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    label: text("label").notNull(),
    tokenHash: text("token_hash").notNull(),
    lastFour: text("last_four").notNull(),
    status: scimTokenStatusEnum("status").notNull().default("active"),
    createdBy: text("created_by").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("scim_tokens_token_hash_idx").on(table.tokenHash),
    index("scim_tokens_organization_idx").on(table.organizationId),
  ]
);

// --- Releases ---------------------------------------------------------------

export const releases = pgTable(
  "releases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    ref: text("ref"),
    environment: text("environment"),
    url: text("url"),
    status: releaseStatusEnum("status").notNull().default("open"),
    dateReleased: timestamp("date_released", { withTimezone: true }),
    commits: jsonb("commits").$type<Array<{ id: string; message: string; author?: string }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("releases_project_version_idx").on(table.projectId, table.version),
    index("releases_project_created_idx").on(table.projectId, table.createdAt),
  ]
);

// Tracks which release an issue was first seen in — powers regression detection
export const releaseIssueFirstSeen = pgTable(
  "release_issue_first_seen",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("release_issue_first_seen_unique_idx").on(table.releaseId, table.issueId),
    index("release_issue_first_seen_project_idx").on(table.projectId, table.firstSeenAt),
  ]
);

// --- Alert Rules ------------------------------------------------------------

export const alertRules = pgTable(
  "alert_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    ruleType: alertRuleTypeEnum("rule_type").notNull(),
    query: jsonb("query").$type<AlertRuleQuery>().notNull().default({}),
    thresholdWindow: integer("threshold_window").notNull().default(60),
    thresholdCount: integer("threshold_count").notNull().default(1),
    environment: text("environment"),
    enabled: boolean("enabled").notNull().default(true),
    cooldownMinutes: integer("cooldown_minutes").notNull().default(30),
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("alert_rules_organization_idx").on(table.organizationId),
    index("alert_rules_project_idx").on(table.projectId),
  ]
);

// --- Alert Channels (notification destinations) -----------------------------

export const alertChannels = pgTable(
  "alert_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    channelType: alertChannelTypeEnum("channel_type").notNull(),
    config: jsonb("config").$type<AlertChannelConfig>().notNull().default({} as AlertChannelConfig),
    enabled: boolean("enabled").notNull().default(true),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("alert_channels_organization_idx").on(table.organizationId),
    index("alert_channels_project_idx").on(table.projectId),
  ]
);

// Join table: which alert rules deliver to which channels
export const alertRuleChannels = pgTable(
  "alert_rule_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => alertRules.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => alertChannels.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("alert_rule_channels_unique_idx").on(table.ruleId, table.channelId),
  ]
);

// --- Alert Delivery Log -----------------------------------------------------

export const alertDeliveries = pgTable(
  "alert_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => alertRules.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => alertChannels.id, { onDelete: "cascade" }),
    status: alertDeliveryStatusEnum("status").notNull().default("pending"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    responseCode: integer("response_code"),
    responseBody: text("response_body"),
    errorMessage: text("error_message"),
    attempt: integer("attempt").notNull().default(1),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("alert_deliveries_rule_idx").on(table.ruleId),
    index("alert_deliveries_channel_idx").on(table.channelId),
    index("alert_deliveries_status_idx").on(table.status, table.createdAt),
  ]
);

// --- Retention Policies (per project or org-default) ------------------------

export const retentionPolicies = pgTable(
  "retention_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    dataType: retentionDataTypeEnum("data_type").notNull(),
    retentionDays: integer("retention_days").notNull().default(90),
    enabled: boolean("enabled").notNull().default(true),
    lastPrunedAt: timestamp("last_pruned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("retention_policies_project_data_idx")
      .on(table.projectId, table.dataType)
      .where(sql`${table.projectId} IS NOT NULL`),
    uniqueIndex("retention_policies_org_data_idx")
      .on(table.organizationId, table.dataType)
      .where(sql`${table.projectId} IS NULL`),
    index("retention_policies_organization_idx").on(table.organizationId),
  ]
);

// --- Types ------------------------------------------------------------------

export type AlertRuleQuery = {
  // Filter — events/transactions/uptime checks matching these match the rule
  levels?: Array<"fatal" | "error" | "warning" | "info" | "debug">;
  environments?: string[];
  tags?: Record<string, string>;
  // Rule-specific config
  uptimeMonitorId?: string;
  transactionName?: string;
};

export type AlertChannelConfig =
  | { kind: "slack"; webhookUrl: string }
  | { kind: "webhook"; url: string; secret?: string }
  | { kind: "email"; recipients: string[] }
  | { kind: "pagerduty"; integrationKey: string }
  | { kind: "discord"; webhookUrl: string }
  | { kind: "msteams"; webhookUrl: string };

export type ApiToken = typeof apiTokens.$inferSelect;
export type NewApiToken = typeof apiTokens.$inferInsert;
export type DsnKey = typeof dsnKeys.$inferSelect;
export type NewDsnKey = typeof dsnKeys.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
export type SsoConnection = typeof ssoConnections.$inferSelect;
export type NewSsoConnection = typeof ssoConnections.$inferInsert;
export type ScimToken = typeof scimTokens.$inferSelect;
export type NewScimToken = typeof scimTokens.$inferInsert;
export type Release = typeof releases.$inferSelect;
export type NewRelease = typeof releases.$inferInsert;
export type ReleaseIssueFirstSeen = typeof releaseIssueFirstSeen.$inferSelect;
export type AlertRule = typeof alertRules.$inferSelect;
export type NewAlertRule = typeof alertRules.$inferInsert;
export type AlertChannel = typeof alertChannels.$inferSelect;
export type NewAlertChannel = typeof alertChannels.$inferInsert;
export type AlertDelivery = typeof alertDeliveries.$inferSelect;
export type NewAlertDelivery = typeof alertDeliveries.$inferInsert;
export type RetentionPolicy = typeof retentionPolicies.$inferSelect;
export type NewRetentionPolicy = typeof retentionPolicies.$inferInsert;
