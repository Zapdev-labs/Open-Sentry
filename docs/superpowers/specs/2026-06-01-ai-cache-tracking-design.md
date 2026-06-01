# AI Generation Cache Tracking — Design

**Date:** 2026-06-01
**Status:** Approved (pending implementation plan)

## Problem

The Open Sentry SDK tracks AI generations (provider, model, tokens, cost, latency) as
first-class data across SDK → ingest → DB → worker → dashboard. LLM prompt caching —
where a provider serves part of the prompt from cache to save cost and latency — is
**not** surfaced anywhere. OpenRouter already returns `prompt_tokens_details.cached_tokens`
and `cache_write_tokens`, and `usageFromOpenRouter` already reads them, but only stuffs
them into the untyped `metadata` jsonb blob. Nothing can aggregate or display them.

We want to answer "how often does it hit the cache?" as a real, queryable metric.

## Goals

- Promote cache token data to first-class fields end-to-end.
- Surface on the AI analytics dashboard:
  - **Cache hit rate** — % of generations where prompt tokens were served from cache.
  - **Cached token volume** — total cached-read tokens and cache-write tokens.
  - **Per-model breakdown** — cache hit rate per model/provider.

## Non-Goals

- **No cost-savings estimate.** We only store net cost, not the provider's cache discount
  rate, so any dollar figure would be invented. Explicitly out of scope.
- No backfill of historical rows from `metadata` (raw values remain in `metadata` for
  old rows; new rows get the typed columns). Existing rows default to 0.
- No new chart components; reuse existing card + table layout on the AI page.

## Tracked Fields

Two new fields, both non-negative integers, default 0:

| Field              | Meaning                                          |
|--------------------|--------------------------------------------------|
| `cachedInputTokens`| Prompt tokens served from cache (the hit signal) |
| `cacheWriteTokens` | Prompt tokens written into the cache             |

A generation is counted as a **cache hit** when `cachedInputTokens > 0`.

## Changes by Layer

### 1. SDK — `packages/sdk/src/`

- `ai-tracking.ts`:
  - Add `cachedInputTokens?: number` and `cacheWriteTokens?: number` to
    `CaptureGenerationOptions`.
  - `buildGenerationItem`: pass both through, defaulting to 0.
  - `usageFromOpenRouter`: set both **directly** from
    `usage.prompt_tokens_details.cached_tokens` / `.cache_write_tokens`
    (default 0). Keep the existing `metadata.cachedTokens` / `metadata.cacheWriteTokens`
    for backward compatibility / raw fidelity.
- `ingest-types.ts`: add the two fields to `AiGenerationIngestItem`.
- `index.ts`: no signature change needed — `captureGeneration` and
  `captureOpenRouterGeneration` already forward options.

### 2. Ingest validation — `packages/db/src/ingest-types.ts`

Add to `aiGenerationPayloadSchema`:
```ts
cachedInputTokens: z.number().int().nonnegative().optional(),
cacheWriteTokens: z.number().int().nonnegative().optional(),
```

### 3. DB schema — `packages/db/src/schema.ts` + migration

- Add to `aiGenerations` table:
  ```ts
  cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
  cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
  ```
- New migration `packages/db/migrations/0004_ai_cache_tokens.sql`:
  ```sql
  ALTER TABLE "ai_generations"
    ADD COLUMN IF NOT EXISTS "cached_input_tokens" integer DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS "cache_write_tokens" integer DEFAULT 0 NOT NULL;
  ```
  (Update drizzle `migrations/meta` snapshot/journal as the project's migration
  workflow requires.)

### 4. Worker — `apps/worker/src/processor.ts`

In `processAiGeneration`, add to the insert values:
```ts
cachedInputTokens: item.cachedInputTokens ?? 0,
cacheWriteTokens: item.cacheWriteTokens ?? 0,
```

### 5. Queries — `apps/web/lib/queries.ts`

- `getAiGenerationStats` return type gains:
  - `cacheHitRate: number` — `round(100 * count(*) filter (cached_input_tokens > 0) / count(*))`
  - `totalCachedTokens: number` — `sum(cached_input_tokens)`
  - `totalCacheWriteTokens: number` — `sum(cache_write_tokens)`
- `getAiGenerationByModel` rows gain:
  - `cachedTokens: number` — `sum(cached_input_tokens)`
  - `cacheHitRate: number` — per-model hit rate, same formula scoped to the group.

### 6. UI — `apps/web/app/(dashboard)/projects/[id]/ai/page.tsx`

- Add stat cards to the bento grid:
  - **Cache hit rate** → `{stats.cacheHitRate}%`
  - **Cached tokens** → `formatTokens(stats.totalCachedTokens)`
  - (Cache-write tokens shown alongside cached tokens, or as a small sub-label.)
- Add a **Cache hit** column to the by-model table showing `{row.cacheHitRate}%`
  (and optionally cached token count).

## Data Flow

```
provider usage
  → usageFromOpenRouter (sets cachedInputTokens, cacheWriteTokens)
  → captureGeneration → buildGenerationItem (AiGenerationIngestItem)
  → ingest endpoint (zod aiGenerationPayloadSchema validates)
  → worker processAiGeneration (insert typed columns)
  → ai_generations table
  → queries (getAiGenerationStats / getAiGenerationByModel aggregate)
  → AI analytics page (cards + table)
```

## Error / Edge Handling

- Missing cache data (non-caching providers, manual `captureGeneration`): fields default
  to 0 → counts as a non-hit, contributes nothing. No errors.
- Division by zero in hit-rate: guard with `count > 0 ? ... : 0` (same pattern as existing
  `errorRate`).
- Old rows (pre-migration): columns are 0; their `metadata` still holds raw values.

## Testing

- SDK unit: `usageFromOpenRouter` maps `cached_tokens`/`cache_write_tokens` to the typed
  fields; `buildGenerationItem` defaults them to 0 when absent.
- Ingest validation: payload with/without cache fields parses; negative values rejected.
- Worker: inserted row persists the two columns.
- Query: `getAiGenerationStats` computes correct hit rate on a fixture mix of hits/misses;
  `getAiGenerationByModel` splits per model.
- UI: renders cache cards; 0-generation empty state unchanged.
