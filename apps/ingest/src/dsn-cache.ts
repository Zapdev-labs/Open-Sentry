import Redis from "ioredis";
import { findProjectIdByPublicKey } from "@sentry-clone/db";

const CACHE_TTL_SECONDS = 300;
const CACHE_PREFIX = "dsn:";
const MEMORY_TTL_MS = 60_000;

let redis: Redis | null = null;
const memoryCache = new Map<string, { projectId: string; expiresAt: number }>();
const inflight = new Map<string, Promise<string | null>>();

function getRedis(): Redis {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  if (!redis) {
    redis = new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
  }
  return redis;
}

function getFromMemory(publicKey: string): string | null {
  const entry = memoryCache.get(publicKey);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(publicKey);
    return null;
  }
  return entry.projectId;
}

function setMemory(publicKey: string, projectId: string): void {
  memoryCache.set(publicKey, { projectId, expiresAt: Date.now() + MEMORY_TTL_MS });
}

export async function resolveProjectId(publicKey: string): Promise<string | null> {
  const mem = getFromMemory(publicKey);
  if (mem) return mem;

  const cacheKey = `${CACHE_PREFIX}${publicKey}`;
  const cached = await getRedis().get(cacheKey);
  if (cached) {
    setMemory(publicKey, cached);
    return cached;
  }

  const pending = inflight.get(publicKey);
  if (pending) return pending;

  const lookup = (async () => {
    const projectId = await findProjectIdByPublicKey(publicKey);
    if (projectId) {
      setMemory(publicKey, projectId);
      void getRedis().set(cacheKey, projectId, "EX", CACHE_TTL_SECONDS);
    }
    return projectId;
  })();

  inflight.set(publicKey, lookup);
  try {
    return await lookup;
  } finally {
    inflight.delete(publicKey);
  }
}

export { getRedis };
