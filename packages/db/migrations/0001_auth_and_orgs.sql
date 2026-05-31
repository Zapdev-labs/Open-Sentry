-- Better Auth tables + organization-scoped projects

CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "organization" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "logo" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "metadata" text,
  CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "active_organization_id" text,
  CONSTRAINT "session_token_unique" UNIQUE("token")
);

CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("user_id");

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "password" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("user_id");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

CREATE TABLE IF NOT EXISTS "member" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "role" text DEFAULT 'member' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "member_organizationId_idx" ON "member" ("organization_id");
CREATE INDEX IF NOT EXISTS "member_userId_idx" ON "member" ("user_id");

CREATE TABLE IF NOT EXISTS "invitation" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "email" text NOT NULL,
  "role" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "expires_at" timestamp NOT NULL,
  "inviter_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "invitation_organizationId_idx" ON "invitation" ("organization_id");

INSERT INTO "organization" ("id", "name", "slug", "created_at")
VALUES ('legacy-org', 'Legacy Workspace', 'legacy-workspace', now())
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "organization_id" text;

UPDATE "projects" SET "organization_id" = 'legacy-org' WHERE "organization_id" IS NULL;

ALTER TABLE "projects" ALTER COLUMN "organization_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "projects_organization_id_idx" ON "projects" ("organization_id");
