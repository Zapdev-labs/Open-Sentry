## Learned User Preferences

- Use Bun as the JavaScript package manager for this project.
- Verify changes with `bun run build`; avoid starting dev servers unless needed (e.g. browser verification).
- Avoid `any` in TypeScript.
- Dashboard UI must follow the minimalist-ui skill (warm monochrome palette, Geist/Newsreader fonts, Phosphor Bold icons; no Lucide/Inter/generic shadcn defaults), with Sentry-inspired information architecture (not a pixel-perfect clone) and dark mode support.
- Verify dashboard routes visually with the user-arch-browser MCP, not cursor-ide-browser.
- Deploy to Railway and link the GitHub repo `Zapdev-labs/sentry-clone`.
- Use Clerk with organizations for production dashboard authentication; do not bootstrap orgs/projects via `db:seed`.
- Do not create unnecessary markdown documentation files.
- Ingest/API documentation should cover the client ingest HTTP API only, not dashboard auth.

## Learned Workspace Facts

- Product name is Open Sentry; production web is `https://open-sentry.up.railway.app`, production ingest is `https://ingest-production-411d.up.railway.app`.
- Bun workspaces monorepo: `apps/ingest`, `apps/worker`, `apps/web`, `packages/db`, `packages/sdk`, `packages/mcp`, `examples/demo-app`.
- Speed-first ingest pipeline: Hono returns 202, enqueues to Redis/BullMQ, worker batches PostgreSQL writes.
- Stack: Hono + Bun (ingest), BullMQ + Redis (queue), Next.js 15 (dashboard), Drizzle + PostgreSQL.
- Railway deploys three services (ingest, worker, web) plus Postgres and Redis plugins via `railway.toml`.
- Local dependencies: Postgres 16 and Redis 7 via `docker-compose.yml`.
- Dashboard auth uses Clerk with organizations; projects are scoped to the active organization; the DB keys app data by Clerk org ID (no FK/webhook sync required for basic scoping).
- Agent API: Bearer org tokens (`osco_…`) against `/api/v1/*` on the web service; MCP server lives in `packages/mcp`.
- Published npm SDK package: `@zapdev-labs/sentry-clone`.
- GitHub remote: `Zapdev-labs/Open-Sentry`.
- Turbo orchestrates monorepo builds; root `package.json` must declare `"packageManager": "bun@1.3.13"` for Turbo 2.x.
- `.gitignore` excludes `node_modules`, `.env`, `.next`, and `.turbo`.
