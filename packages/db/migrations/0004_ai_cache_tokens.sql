ALTER TABLE "ai_generations"
  ADD COLUMN IF NOT EXISTS "cached_input_tokens" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "cache_write_tokens" integer DEFAULT 0 NOT NULL;
