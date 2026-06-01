import { describe, test, expect } from "bun:test";
import {
  usageFromOpenRouter,
  buildGenerationItem,
  type OpenRouterUsage,
} from "../src/ai-tracking.js";

const scope = { tags: {} };
const defaults = { environment: "test", release: "1.0.0" };

describe("usageFromOpenRouter", () => {
  test("maps cached_tokens and cache_write_tokens to typed fields", () => {
    const usage: OpenRouterUsage = {
      prompt_tokens: 100,
      completion_tokens: 20,
      total_tokens: 120,
      prompt_tokens_details: { cached_tokens: 60, cache_write_tokens: 40 },
    };

    const opts = usageFromOpenRouter(usage, "gpt-4o");

    expect(opts.cachedInputTokens).toBe(60);
    expect(opts.cacheWriteTokens).toBe(40);
  });

  test("defaults cache fields to 0 when provider omits them", () => {
    const usage: OpenRouterUsage = { prompt_tokens: 100, completion_tokens: 20 };

    const opts = usageFromOpenRouter(usage, "gpt-4o");

    expect(opts.cachedInputTokens).toBe(0);
    expect(opts.cacheWriteTokens).toBe(0);
  });

  test("retains raw cache values in metadata for fidelity", () => {
    const usage: OpenRouterUsage = {
      prompt_tokens: 100,
      prompt_tokens_details: { cached_tokens: 60, cache_write_tokens: 40 },
    };

    const opts = usageFromOpenRouter(usage, "gpt-4o");

    expect(opts.metadata?.cachedTokens).toBe(60);
    expect(opts.metadata?.cacheWriteTokens).toBe(40);
  });
});

describe("buildGenerationItem", () => {
  test("passes cache fields through to the ingest item", () => {
    const item = buildGenerationItem(
      {
        provider: "openrouter",
        model: "gpt-4o",
        inputTokens: 100,
        cachedInputTokens: 60,
        cacheWriteTokens: 40,
      },
      scope,
      defaults
    );

    expect(item.cachedInputTokens).toBe(60);
    expect(item.cacheWriteTokens).toBe(40);
  });

  test("defaults cache fields to 0 when absent", () => {
    const item = buildGenerationItem(
      { provider: "anthropic", model: "claude", inputTokens: 50 },
      scope,
      defaults
    );

    expect(item.cachedInputTokens).toBe(0);
    expect(item.cacheWriteTokens).toBe(0);
  });
});
