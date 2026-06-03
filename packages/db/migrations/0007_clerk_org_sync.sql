-- Backfill organization rows for Clerk org ids already referenced by app data
INSERT INTO "organization" ("id", "name", "slug", "created_at")
SELECT DISTINCT src.organization_id,
  'Workspace ' || LEFT(src.organization_id, 12),
  'org-' || REPLACE(LOWER(src.organization_id), '_', '-') || '-' || SUBSTRING(MD5(src.organization_id) FROM 1 FOR 6),
  NOW()
FROM (
  SELECT "organization_id" FROM "projects"
  UNION
  SELECT "organization_id" FROM "alert_rules"
  UNION
  SELECT "organization_id" FROM "alert_channels"
  UNION
  SELECT "organization_id" FROM "api_tokens"
  UNION
  SELECT "organization_id" FROM "audit_log"
  UNION
  SELECT "organization_id" FROM "retention_policies"
) AS src
WHERE src.organization_id IS NOT NULL
  AND src.organization_id <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "organization" o WHERE o."id" = src.organization_id
  )
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "member_org_user_unique" ON "member" ("organization_id", "user_id");
