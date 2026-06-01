import { describe, test, expect } from "bun:test";
import { aiGenerationPayloadSchema } from "../src/ingest-types.js";

const base = {
  type: "ai_generation" as const,
  provider: "openrouter",
  model: "gpt-4o",
  inputTokens: 100,
};

describe("aiGenerationPayloadSchema cache fields", () => {
  test("parses a payload with cache fields", () => {
    const result = aiGenerationPayloadSchema.safeParse({
      ...base,
      cachedInputTokens: 60,
      cacheWriteTokens: 40,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cachedInputTokens).toBe(60);
      expect(result.data.cacheWriteTokens).toBe(40);
    }
  });

  test("parses a payload without cache fields (optional)", () => {
    const result = aiGenerationPayloadSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  test("rejects negative cached token counts", () => {
    const result = aiGenerationPayloadSchema.safeParse({
      ...base,
      cachedInputTokens: -1,
    });
    expect(result.success).toBe(false);
  });
});
