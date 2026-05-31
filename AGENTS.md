## Learned User Preferences

- Use Bun as the JavaScript package manager for this project.
- Verify changes with `bun run build`; avoid starting dev servers unless needed (e.g. browser verification).
- Avoid `any` in TypeScript.
- Dashboard UI must follow the minimalist-ui skill (warm monochrome palette, Geist/Newsreader fonts, Phosphor Bold icons; no Lucide/Inter/generic shadcn defaults).
- Verify dashboard routes visually with the user-arch-browser MCP, not cursor-ide-browser.
- Deploy to Railway and link the GitHub repo `Zapdev-labs/sentry-clone`.
- Use Better Auth with the organization plugin for production dashboard authentication.
- Do not create unnecessary markdown documentation files.

## Learned Workspace Facts

- Bun workspaces monorepo: `apps/ingest`, `apps/worker`, `apps/web`, `packages/db`, `packages/sdk`, `examples/demo-app`.
- Speed-first ingest pipeline: Hono returns 202, enqueues to Redis/BullMQ, worker batches PostgreSQL writes.
- Stack: Hono + Bun (ingest), BullMQ + Redis (queue), Next.js 15 (dashboard), Drizzle + PostgreSQL.
- Railway deploys three services (ingest, worker, web) plus Postgres and Redis plugins via `railway.toml`.
- Local dependencies: Postgres 16 and Redis 7 via `docker-compose.yml`.
- Dashboard auth uses Better Auth with organizations; projects are scoped to the active organization.
- GitHub remote: `Zapdev-labs/sentry-clone`.
- Turbo orchestrates monorepo builds; root `package.json` must declare `"packageManager": "bun@1.3.13"` for Turbo 2.x.
- `.gitignore` excludes `node_modules`, `.env`, and `.next`.
