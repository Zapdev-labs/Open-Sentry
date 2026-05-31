-- Custom SQL migration generated for sentry-clone MVP

CREATE TYPE "public"."issue_status" AS ENUM('open', 'resolved', 'ignored');
CREATE TYPE "public"."issue_level" AS ENUM('fatal', 'error', 'warning', 'info', 'debug');
CREATE TYPE "public"."transaction_status" AS ENUM('ok', 'error', 'cancelled');

CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "public_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "projects_public_key_idx" ON "projects" ("public_key");

CREATE TABLE IF NOT EXISTS "issues" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "fingerprint" text NOT NULL,
  "title" text NOT NULL,
  "level" "issue_level" DEFAULT 'error' NOT NULL,
  "status" "issue_status" DEFAULT 'open' NOT NULL,
  "first_seen" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen" timestamp with time zone DEFAULT now() NOT NULL,
  "event_count" integer DEFAULT 1 NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "issues_project_fingerprint_idx" ON "issues" ("project_id", "fingerprint");
CREATE INDEX IF NOT EXISTS "issues_project_status_last_seen_idx" ON "issues" ("project_id", "status", "last_seen");
CREATE INDEX IF NOT EXISTS "issues_open_partial_idx" ON "issues" ("project_id", "last_seen") WHERE "status" = 'open';

CREATE TABLE IF NOT EXISTS "events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "issue_id" uuid NOT NULL REFERENCES "issues"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "message" text NOT NULL,
  "stack" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "breadcrumbs" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "tags" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "user" jsonb,
  "environment" text,
  "release" text,
  "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "events_issue_timestamp_idx" ON "events" ("issue_id", "timestamp");
CREATE INDEX IF NOT EXISTS "events_project_timestamp_idx" ON "events" ("project_id", "timestamp");

CREATE TABLE IF NOT EXISTS "transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "trace_id" text NOT NULL,
  "duration_ms" integer NOT NULL,
  "status" "transaction_status" DEFAULT 'ok' NOT NULL,
  "environment" text,
  "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "transactions_project_timestamp_idx" ON "transactions" ("project_id", "timestamp");
CREATE INDEX IF NOT EXISTS "transactions_trace_id_idx" ON "transactions" ("trace_id");

CREATE TABLE IF NOT EXISTS "spans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "transaction_id" uuid NOT NULL REFERENCES "transactions"("id") ON DELETE cascade,
  "span_id" text NOT NULL,
  "op" text NOT NULL,
  "description" text,
  "duration_ms" integer NOT NULL,
  "parent_span_id" text
);

CREATE INDEX IF NOT EXISTS "spans_transaction_id_idx" ON "spans" ("transaction_id");
