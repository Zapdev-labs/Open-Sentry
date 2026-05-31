# Ingest API reference

HTTP API for sending errors and performance data to Open Sentry. Authenticate with your project **public key** via header, query string, or DSN URL.

### Base URLs

| Environment | Base URL | Ingest endpoint |
|-------------|----------|-----------------|
| **Local** | `http://localhost:3001` | `http://localhost:3001/v1/ingest` |
| **Production (Railway)** | `https://ingest-production-411d.up.railway.app` | `https://ingest-production-411d.up.railway.app/v1/ingest` |

**Health check (production)**

```bash
curl https://ingest-production-411d.up.railway.app/health
```

**Send an event (production)**

```bash
curl -X POST "https://ingest-production-411d.up.railway.app/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "X-Open-Sentry-Key: YOUR_PUBLIC_KEY" \
  -d '{"type":"error","exception":{"type":"Error","value":"test from curl"}}'
```

**DSN** (SDK — public key is the URL username):

```text
https://YOUR_PUBLIC_KEY@ingest-production-411d.up.railway.app/v1/ingest
```

---

### `GET /health`

**Local:** `GET http://localhost:3001/health`  
**Production:** `GET https://ingest-production-411d.up.railway.app/health`

```json
{ "status": "ok" }
```

### `POST /v1/ingest`

**Local:** `POST http://localhost:3001/v1/ingest`  
**Production:** `POST https://ingest-production-411d.up.railway.app/v1/ingest`

Accepts one ingest item or an array of 1–20 items.

**Authentication** (required):

| Method | Example |
|--------|---------|
| Header | `X-Open-Sentry-Key: abc123...` (legacy: `X-Sentry-Clone-Key`) |
| Query | `?key=abc123...` (used by browser beacon) |

**Headers**:

- `Content-Type: application/json`

**Success — `202 Accepted`**

```json
{ "id": "550e8400-e29b-41d4-a716-446655440000" }
```

`id` is the batch or job id used for tracing enqueue (not the DB event id).

**Errors**

| Status | Body | Cause |
|--------|------|-------|
| 400 | `{ "error": "Invalid JSON" }` | Body not JSON |
| 400 | `{ "error": "Invalid payload" }` | Zod validation failed |
| 401 | `{ "error": "Missing auth key" }` | No key header/query |
| 403 | `{ "error": "Invalid DSN key" }` | Unknown `public_key` |
| 413 | `{ "error": "Payload too large" }` | Body > 256 KiB |

---

### Error item (`type: "error"`)

```json
{
  "type": "error",
  "exception": {
    "type": "TypeError",
    "value": "Cannot read property 'x' of undefined",
    "stacktrace": {
      "frames": [
        {
          "filename": "app/page.tsx",
          "function": "loadData",
          "lineno": 42,
          "colno": 12,
          "inApp": true
        }
      ]
    }
  },
  "message": "optional fallback message",
  "breadcrumbs": [
    {
      "category": "navigation",
      "message": "User opened settings",
      "level": "info",
      "timestamp": "2026-05-30T12:00:00.000Z"
    }
  ],
  "tags": { "region": "us-east" },
  "user": { "id": "user_123", "email": "dev@example.com" },
  "environment": "production",
  "release": "web@2.4.1",
  "timestamp": "2026-05-30T12:00:01.000Z"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `type` | yes | Must be `"error"` |
| `exception` | yes | `type`, `value`, optional `stacktrace.frames` |
| `breadcrumbs` | no | Max practical limit enforced client-side |
| `tags`, `user` | no | String maps |
| `environment`, `release` | no | Stored on `events` |
| `timestamp` | no | ISO 8601; defaults to worker receive time |

---

### Transaction item (`type: "transaction"`)

```json
{
  "type": "transaction",
  "name": "GET /api/checkout",
  "traceId": "trace-abc-123",
  "durationMs": 245,
  "status": "ok",
  "environment": "production",
  "spans": [
    {
      "spanId": "span-1",
      "op": "db.query",
      "description": "SELECT * FROM orders",
      "durationMs": 40,
      "parentSpanId": "root-span-id"
    }
  ],
  "timestamp": "2026-05-30T12:00:02.000Z"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `type` | yes | `"transaction"` |
| `name` | yes | Route or operation name |
| `traceId` | yes | Correlation id |
| `durationMs` | yes | Integer milliseconds |
| `status` | no | `ok` \| `error` \| `cancelled` (default `ok`) |
| `spans` | no | Inserted when parent transaction row exists |

---

### Batch example

```json
[
  { "type": "error", "exception": { "type": "Error", "value": "first" } },
  { "type": "error", "exception": { "type": "Error", "value": "second" } }
]
```

---

## Payload schemas (code)

Canonical Zod schemas: `packages/db/src/ingest-types.ts`.

Exported types: `IngestItem`, `IngestPayload`, `StackFrame`, `Breadcrumb`.

The SDK mirrors ingest shapes in `packages/sdk/src/ingest-types.ts` for compile-time safety.
