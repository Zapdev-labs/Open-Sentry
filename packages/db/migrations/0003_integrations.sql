CREATE TYPE "public"."integration_provider" AS ENUM('linear');

CREATE TABLE IF NOT EXISTS "project_integrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "provider" "integration_provider" NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_integrations_project_provider_idx"
  ON "project_integrations" ("project_id", "provider");

CREATE TABLE IF NOT EXISTS "issue_external_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "issue_id" uuid NOT NULL REFERENCES "issues"("id") ON DELETE CASCADE,
  "provider" "integration_provider" NOT NULL,
  "external_id" text NOT NULL,
  "external_url" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "issue_external_links_issue_provider_idx"
  ON "issue_external_links" ("issue_id", "provider");
