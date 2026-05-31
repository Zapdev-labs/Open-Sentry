# Open Sentry

Self-hosted error and performance monitoring. Events are accepted over a fast ingest API, queued in Redis, batched into PostgreSQL, and browsed in a Next.js dashboard with organization-scoped projects.

## What you get

| Layer | Role |
|-------|------|
| **SDK** (`@zapdev-labs/sentry-clone`) | Capture errors, messages, breadcrumbs, and transactions from Node or the browser |
| **Ingest** (`apps/ingest`) | Hono on Bun — validates payloads, resolves DSN keys, returns **202** and enqueues work |
| **Worker** (`apps/worker`) | BullMQ consumer — micro-batches jobs and writes issues, events, transactions, spans |
| **Web** (`apps/web`) | Next.js 15 dashboard — Better Auth, organizations, projects, issues, performance |
| **DB** (`packages/db`) | Drizzle schema, Zod ingest types, fingerprinting, migrations |

## Quick start

```bash
# Dependencies
bun install

# Postgres + Redis
docker compose up -d

# Schema
bun run db:migrate

# Build all packages
bun run build

# Run ingest, worker, and web (three terminals or turbo dev)
bun run dev
```

Copy `.env.example` to `.env` and adjust URLs. After sign-up, create a project in the dashboard and copy its DSN into your app.

## Documentation map

| Page | Audience | Contents |
|------|----------|----------|
| [Architecture](./architecture.md) | Implementers | Data flow, queues, grouping, caching |
| [API reference](./api-reference.md) | Integrators | Ingest and dashboard HTTP APIs |
| [SDK guide](./sdk-guide.md) | App developers | Init, capture, transactions, DSN format |
| [Development](./development.md) | Contributors | Monorepo layout, scripts, testing |
| [Deployment](./deployment.md) | Operators | Railway services, env wiring |
| [Environment](./environment.md) | Everyone | Variable reference |

## DSN format

```
https://{publicKey}@{ingest-host}/v1/ingest
```

The public key is the project’s `public_key` column. The SDK sends it as `X-Open-Sentry-Key` or `?key=` (for `sendBeacon`).

## Example: send one error

```bash
curl -X POST "$INGEST_URL/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "X-Open-Sentry-Key: YOUR_PUBLIC_KEY" \
  -d '{
    "type": "error",
    "exception": {
      "type": "Error",
      "value": "Hello from curl",
      "stacktrace": { "frames": [] }
    },
    "environment": "staging",
    "release": "api-test@1"
  }'
```

Expected response: `202` with `{ "id": "<batch-uuid>" }`.

## Repository layout

```
apps/
  ingest/     # Hono ingest API (Bun)
  worker/     # BullMQ batch writer
  web/        # Next.js dashboard + /docs
packages/
  db/         # Schema, migrations, ingest Zod schemas
  sdk/        # Client SDK (npm: @zapdev-labs/sentry-clone)
examples/
  demo-app/   # Scripted SDK demo
docs/         # Source markdown (this folder)
```

## License

MIT — SDK package published as `@zapdev-labs/sentry-clone`.
