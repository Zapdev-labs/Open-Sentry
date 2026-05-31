import { Hono } from "hono";
import { resolveProjectId } from "./dsn-cache.js";
import { enqueueIngestBatch, warmQueue } from "./queue.js";
import { normalizeBatch } from "./validation.js";

const MAX_BODY_BYTES = 256 * 1024;
const app = new Hono();

await warmQueue();

app.get("/health", (c) => c.json({ status: "ok" }));

app.post("/v1/ingest", async (c) => {
  const publicKey =
    c.req.header("X-Sentry-Clone-Key") ??
    c.req.query("key") ??
    null;
  if (!publicKey) {
    return c.json({ error: "Missing auth key" }, 401);
  }

  const rawBody = await c.req.arrayBuffer();
  if (rawBody.byteLength > MAX_BODY_BYTES) {
    return c.json({ error: "Payload too large" }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  let items;
  try {
    items = normalizeBatch(body);
  } catch {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const projectId = await resolveProjectId(publicKey);
  if (!projectId) {
    return c.json({ error: "Invalid DSN key" }, 403);
  }

  const batchId = await enqueueIngestBatch(projectId, items);
  return c.json({ id: batchId }, 202);
});

const port = Number.parseInt(process.env.INGEST_PORT ?? process.env.PORT ?? "3001", 10);

console.log(`Ingest service listening on :${port}`);

export default {
  port,
  fetch: app.fetch,
};
