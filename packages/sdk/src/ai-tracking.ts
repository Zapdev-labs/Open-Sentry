import type { AiGenerationIngestItem } from "./ingest-types.js";
import type { UserContext } from "./scope.js";

export interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
  cost_details?: {
    upstream_inference_cost?: number;
  };
  prompt_tokens_details?: {
    cached_tokens?: number;
    cache_write_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
}

export interface CaptureGenerationOptions {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
  inputCostUsd?: number;
  outputCostUsd?: number;
  totalCostUsd?: number;
  latencyMs?: number;
  timeToFirstTokenMs?: number;
  status?: "ok" | "error";
  traceId?: string;
  spanId?: string;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export function buildGenerationItem(
  opts: CaptureGenerationOptions,
  scope: {
    tags: Record<string, string>;
    user?: UserContext;
  },
  defaults: {
    environment: string;
    release: string;
  }
): AiGenerationIngestItem {
  const outputTokens = opts.outputTokens ?? 0;
  const user = scope.user
    ? Object.fromEntries(
        Object.entries(scope.user).filter((entry): entry is [string, string] => entry[1] != null)
      )
    : undefined;

  return {
    type: "ai_generation",
    provider: opts.provider,
    model: opts.model,
    inputTokens: opts.inputTokens,
    outputTokens,
    totalTokens: opts.totalTokens ?? opts.inputTokens + outputTokens,
    cachedInputTokens: opts.cachedInputTokens ?? 0,
    cacheWriteTokens: opts.cacheWriteTokens ?? 0,
    inputCostUsd: opts.inputCostUsd,
    outputCostUsd: opts.outputCostUsd,
    totalCostUsd: opts.totalCostUsd,
    latencyMs: opts.latencyMs,
    timeToFirstTokenMs: opts.timeToFirstTokenMs,
    status: opts.status,
    traceId: opts.traceId,
    spanId: opts.spanId,
    tags: Object.keys({ ...scope.tags, ...opts.tags }).length
      ? { ...scope.tags, ...opts.tags }
      : opts.tags,
    user: user && Object.keys(user).length > 0 ? user : undefined,
    metadata: opts.metadata,
    environment: defaults.environment,
    release: defaults.release,
    timestamp: new Date().toISOString(),
  };
}

export function usageFromOpenRouter(
  usage: OpenRouterUsage,
  model: string
): CaptureGenerationOptions {
  const inputTokens = usage.prompt_tokens ?? 0;
  const outputTokens = usage.completion_tokens ?? 0;
  const totalCostUsd = usage.cost;

  return {
    provider: "openrouter",
    model,
    inputTokens,
    outputTokens,
    totalTokens: usage.total_tokens ?? inputTokens + outputTokens,
    cachedInputTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
    cacheWriteTokens: usage.prompt_tokens_details?.cache_write_tokens ?? 0,
    totalCostUsd,
    metadata: {
      cachedTokens: usage.prompt_tokens_details?.cached_tokens,
      cacheWriteTokens: usage.prompt_tokens_details?.cache_write_tokens,
      reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
      upstreamInferenceCost: usage.cost_details?.upstream_inference_cost,
    },
  };
}
