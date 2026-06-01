CREATE TYPE "public"."alert_channel_type" AS ENUM('slack', 'webhook', 'email', 'pagerduty', 'discord', 'msteams');--> statement-breakpoint
CREATE TYPE "public"."alert_delivery_status" AS ENUM('pending', 'delivered', 'failed', 'rate_limited');--> statement-breakpoint
CREATE TYPE "public"."alert_rule_type" AS ENUM('issue.count_threshold', 'issue.new', 'issue.regression', 'issue.frequency_spike', 'transaction.error_rate', 'transaction.p95_latency', 'uptime.down', 'uptime.recovered');--> statement-breakpoint
CREATE TYPE "public"."api_token_scope" AS ENUM('read', 'write', 'admin');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('member.invited', 'member.removed', 'member.role_changed', 'project.created', 'project.deleted', 'project.settings_updated', 'api_token.created', 'api_token.revoked', 'dsn.created', 'dsn.revoked', 'sso.configured', 'sso.disabled', 'scim.token_created', 'scim.token_revoked', 'release.created', 'alert_rule.created', 'alert_rule.updated', 'alert_rule.deleted', 'alert_channel.created', 'alert_channel.deleted', 'retention.updated', 'data.exported');--> statement-breakpoint
CREATE TYPE "public"."dsn_environment" AS ENUM('production', 'staging', 'development', 'test', 'custom');--> statement-breakpoint
CREATE TYPE "public"."release_status" AS ENUM('open', 'shipped', 'archived');--> statement-breakpoint
CREATE TYPE "public"."retention_data_type" AS ENUM('events', 'transactions', 'spans', 'ai_generations', 'uptime_checks', 'all');--> statement-breakpoint
CREATE TYPE "public"."scim_token_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."sso_provider_type" AS ENUM('saml', 'oidc');--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'slack';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'discord';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'msteams';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'pagerduty';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'webhook';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'email';--> statement-breakpoint
CREATE TABLE "alert_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"channel_type" "alert_channel_type" NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"status" "alert_delivery_status" DEFAULT 'pending' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"response_code" integer,
	"response_body" text,
	"error_message" text,
	"attempt" integer DEFAULT 1 NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_rule_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"rule_type" "alert_rule_type" NOT NULL,
	"query" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"threshold_window" integer DEFAULT 60 NOT NULL,
	"threshold_count" integer DEFAULT 1 NOT NULL,
	"environment" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"cooldown_minutes" integer DEFAULT 30 NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"last_four" text NOT NULL,
	"scope" "api_token_scope" DEFAULT 'read' NOT NULL,
	"created_by" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"actor_id" text,
	"actor_email" text,
	"action" "audit_action" NOT NULL,
	"target_type" text,
	"target_id" text,
	"target_label" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dsn_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"public_key" text NOT NULL,
	"environment" "dsn_environment" DEFAULT 'production' NOT NULL,
	"label" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_issue_first_seen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version" text NOT NULL,
	"ref" text,
	"environment" text,
	"url" text,
	"status" "release_status" DEFAULT 'open' NOT NULL,
	"date_released" timestamp with time zone,
	"commits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retention_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" uuid,
	"data_type" "retention_data_type" NOT NULL,
	"retention_days" integer DEFAULT 90 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_pruned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scim_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"label" text NOT NULL,
	"token_hash" text NOT NULL,
	"last_four" text NOT NULL,
	"status" "scim_token_status" DEFAULT 'active' NOT NULL,
	"created_by" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sso_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"provider_type" "sso_provider_type" NOT NULL,
	"provider_name" text NOT NULL,
	"email_domains" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "first_release" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "last_release" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "regression_of" uuid;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "resolved_by" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "release" text;--> statement-breakpoint
ALTER TABLE "alert_channels" ADD CONSTRAINT "alert_channels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_rule_id_alert_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_channel_id_alert_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."alert_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rule_channels" ADD CONSTRAINT "alert_rule_channels_rule_id_alert_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rule_channels" ADD CONSTRAINT "alert_rule_channels_channel_id_alert_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."alert_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsn_keys" ADD CONSTRAINT "dsn_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_issue_first_seen" ADD CONSTRAINT "release_issue_first_seen_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_issue_first_seen" ADD CONSTRAINT "release_issue_first_seen_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_issue_first_seen" ADD CONSTRAINT "release_issue_first_seen_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_policies" ADD CONSTRAINT "retention_policies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_channels_organization_idx" ON "alert_channels" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "alert_channels_project_idx" ON "alert_channels" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "alert_deliveries_rule_idx" ON "alert_deliveries" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "alert_deliveries_channel_idx" ON "alert_deliveries" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "alert_deliveries_status_idx" ON "alert_deliveries" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "alert_rule_channels_unique_idx" ON "alert_rule_channels" USING btree ("rule_id","channel_id");--> statement-breakpoint
CREATE INDEX "alert_rules_organization_idx" ON "alert_rules" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "alert_rules_project_idx" ON "alert_rules" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_tokens_token_hash_idx" ON "api_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "api_tokens_organization_id_idx" ON "api_tokens" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "api_tokens_project_id_idx" ON "api_tokens" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "audit_log_organization_created_idx" ON "audit_log" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_organization_action_idx" ON "audit_log" USING btree ("organization_id","action");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dsn_keys_public_key_idx" ON "dsn_keys" USING btree ("public_key");--> statement-breakpoint
CREATE INDEX "dsn_keys_project_id_idx" ON "dsn_keys" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dsn_keys_project_environment_idx" ON "dsn_keys" USING btree ("project_id","environment") WHERE "dsn_keys"."revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "release_issue_first_seen_unique_idx" ON "release_issue_first_seen" USING btree ("release_id","issue_id");--> statement-breakpoint
CREATE INDEX "release_issue_first_seen_project_idx" ON "release_issue_first_seen" USING btree ("project_id","first_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "releases_project_version_idx" ON "releases" USING btree ("project_id","version");--> statement-breakpoint
CREATE INDEX "releases_project_created_idx" ON "releases" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "retention_policies_project_data_idx" ON "retention_policies" USING btree ("project_id","data_type") WHERE "retention_policies"."project_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "retention_policies_org_data_idx" ON "retention_policies" USING btree ("organization_id","data_type") WHERE "retention_policies"."project_id" IS NULL;--> statement-breakpoint
CREATE INDEX "retention_policies_organization_idx" ON "retention_policies" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scim_tokens_token_hash_idx" ON "scim_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "scim_tokens_organization_idx" ON "scim_tokens" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "sso_connections_organization_idx" ON "sso_connections" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "issues_first_release_idx" ON "issues" USING btree ("project_id","first_release");--> statement-breakpoint
CREATE INDEX "transactions_project_release_idx" ON "transactions" USING btree ("project_id","release");