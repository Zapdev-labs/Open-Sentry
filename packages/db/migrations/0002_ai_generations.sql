CREATE TYPE "public"."ai_generation_status" AS ENUM('ok', 'error');

CREATE TABLE IF NOT EXISTS "ai_generations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "trace_id" text,
  "span_id" text,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  "total_tokens" integer DEFAULT 0 NOT NULL,
  "input_cost_usd" text,
  "output_cost_usd" text,
  "total_cost_usd" text,
  "latency_ms" integer,
  "time_to_first_token_ms" integer,
  "status" "ai_generation_status" DEFAULT 'ok' NOT NULL,
  "tags" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "user" jsonb,
  "metadata" jsonb,
  "environment" text,
  "release" text,
  "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ai_generations_project_timestamp_idx" ON "ai_generations" ("project_id", "timestamp");
CREATE INDEX IF NOT EXISTS "ai_generations_project_model_idx" ON "ai_generations" ("project_id", "model");
CREATE INDEX IF NOT EXISTS "ai_generations_project_provider_idx" ON "ai_generations" ("project_id", "provider");
