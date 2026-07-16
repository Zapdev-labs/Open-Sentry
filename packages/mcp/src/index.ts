#!/usr/bin/env bun
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { OpenSentryApiError, OpenSentryClient } from "./client.ts";

function loadDotEnvFile(path: string) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function bootstrapEnv() {
  const home = homedir();
  for (const path of [
    join(home, "ai-apply", ".env.local"),
    join(home, "ai-apply", ".env"),
    join(home, ".config", "open-sentry.env"),
    join(home, "sentry-clone", ".env"),
  ]) {
    loadDotEnvFile(path);
  }
}

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(
      `Missing required env var: ${name}. Create an org API token in Open Sentry → Settings → API Tokens (scope write), then set OPEN_SENTRY_TOKEN in ~/ai-apply/.env.local`
    );
  }
  return value;
}

function textResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  if (err instanceof OpenSentryApiError) {
    return {
      isError: true as const,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { error: err.message, status: err.status, body: err.body },
            null,
            2
          ),
        },
      ],
    };
  }

  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }],
  };
}

function createClient() {
  return new OpenSentryClient({
    baseUrl: env("OPEN_SENTRY_URL", "https://open-sentry.up.railway.app"),
    token: env("OPEN_SENTRY_TOKEN"),
  });
}

function createServer() {
  const server = new McpServer({
    name: "open-sentry",
    version: "0.1.0",
  });

  const client = createClient();

  server.registerTool(
    "open_sentry_whoami",
    {
      description:
        "Show the authenticated Open Sentry API token identity (org, scope, name).",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        return textResult(await client.me());
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "open_sentry_org_stats",
    {
      description:
        "Get organization-level stats: project count, open issues, events today, error rate.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        return textResult(await client.orgStats());
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "open_sentry_recent_activity",
    {
      description: "List recent error events across the organization.",
      inputSchema: z.object({
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Max events to return (default 8)"),
      }),
    },
    async ({ limit }) => {
      try {
        return textResult(await client.orgActivity(limit));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "open_sentry_list_projects",
    {
      description:
        "List all Open Sentry projects with open issue counts and event totals.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        return textResult(await client.listProjects());
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "open_sentry_get_project",
    {
      description:
        "Get a project by id, including DSN and overview metrics (open/resolved/ignored issues).",
      inputSchema: z.object({
        projectId: z.string().describe("Project UUID"),
      }),
    },
    async ({ projectId }) => {
      try {
        return textResult(await client.getProject(projectId));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "open_sentry_create_project",
    {
      description: "Create a new Open Sentry project (requires write or admin token).",
      inputSchema: z.object({
        name: z.string().min(1).max(120).describe("Project name"),
      }),
    },
    async ({ name }) => {
      try {
        return textResult(await client.createProject(name));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "open_sentry_list_issues",
    {
      description:
        "List issues for a project. Filter by status (open/resolved/ignored) and level.",
      inputSchema: z.object({
        projectId: z.string().describe("Project UUID"),
        status: z
          .enum(["open", "resolved", "ignored"])
          .optional()
          .describe("Issue status filter"),
        level: z
          .enum(["fatal", "error", "warning", "info", "debug"])
          .optional()
          .describe("Issue level filter"),
      }),
    },
    async ({ projectId, status, level }) => {
      try {
        return textResult(await client.listIssues(projectId, { status, level }));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "open_sentry_get_issue",
    {
      description: "Get full details for a single issue.",
      inputSchema: z.object({
        issueId: z.string().describe("Issue UUID"),
      }),
    },
    async ({ issueId }) => {
      try {
        return textResult(await client.getIssue(issueId));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "open_sentry_update_issue",
    {
      description:
        "Update an issue status: resolve, ignore, or reopen (requires write or admin token).",
      inputSchema: z.object({
        issueId: z.string().describe("Issue UUID"),
        status: z
          .enum(["open", "resolved", "ignored"])
          .describe("New status — resolved closes the issue, ignored silences it, open reopens"),
      }),
    },
    async ({ issueId, status }) => {
      try {
        return textResult(await client.updateIssue(issueId, status));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "open_sentry_list_issue_events",
    {
      description:
        "List events for an issue plus a 7-day occurrence timeline. Use cursor for pagination.",
      inputSchema: z.object({
        issueId: z.string().describe("Issue UUID"),
        cursor: z
          .string()
          .optional()
          .describe("ISO timestamp cursor — return events older than this"),
        limit: z.number().int().min(1).max(100).optional(),
      }),
    },
    async ({ issueId, cursor, limit }) => {
      try {
        return textResult(await client.listIssueEvents(issueId, { cursor, limit }));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "open_sentry_get_performance",
    {
      description:
        "Get performance stats (p50/p95/avg) and recent transactions for a project.",
      inputSchema: z.object({
        projectId: z.string().describe("Project UUID"),
        limit: z.number().int().min(1).max(100).optional(),
      }),
    },
    async ({ projectId, limit }) => {
      try {
        return textResult(await client.getPerformance(projectId, limit));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "open_sentry_get_ai_usage",
    {
      description:
        "Get AI/LLM generation usage, cost, and recent generations for a project.",
      inputSchema: z.object({
        projectId: z.string().describe("Project UUID"),
        limit: z.number().int().min(1).max(100).optional(),
      }),
    },
    async ({ projectId, limit }) => {
      try {
        return textResult(await client.getAi(projectId, limit));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "open_sentry_list_alert_rules",
    {
      description: "List alert rules for the organization, optionally filtered by project.",
      inputSchema: z.object({
        projectId: z.string().optional().describe("Optional project UUID filter"),
      }),
    },
    async ({ projectId }) => {
      try {
        return textResult(await client.listAlertRules(projectId));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "open_sentry_resolve_issue",
    {
      description: "Shortcut to mark an issue as resolved (requires write or admin token).",
      inputSchema: z.object({
        issueId: z.string().describe("Issue UUID"),
      }),
    },
    async ({ issueId }) => {
      try {
        return textResult(await client.updateIssue(issueId, "resolved"));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "open_sentry_ignore_issue",
    {
      description: "Shortcut to ignore an issue (requires write or admin token).",
      inputSchema: z.object({
        issueId: z.string().describe("Issue UUID"),
      }),
    },
    async ({ issueId }) => {
      try {
        return textResult(await client.updateIssue(issueId, "ignored"));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "open_sentry_reopen_issue",
    {
      description: "Shortcut to reopen an issue (requires write or admin token).",
      inputSchema: z.object({
        issueId: z.string().describe("Issue UUID"),
      }),
    },
    async ({ issueId }) => {
      try {
        return textResult(await client.updateIssue(issueId, "open"));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
}

async function main() {
  bootstrapEnv();
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Open Sentry MCP server running on stdio");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
