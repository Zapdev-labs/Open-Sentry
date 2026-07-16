import { NextResponse } from "next/server";
import type { ApiToken } from "@sentry-clone/db";
import { authenticateApiToken } from "./queries-tokens";
import { getIssue, getProject } from "./queries";

export type ApiAuth = Omit<ApiToken, "tokenHash">;

type Scope = "read" | "write" | "admin";

const SCOPE_RANK: Record<Scope, number> = {
  read: 0,
  write: 1,
  admin: 2,
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireApiAuth(
  request: Request,
  minScope: Scope = "read"
): Promise<ApiAuth> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new ApiError(401, "Missing or invalid Authorization header");
  }

  const plaintext = header.slice("Bearer ".length).trim();
  const token = await authenticateApiToken(plaintext);
  if (!token) {
    throw new ApiError(401, "Invalid or expired API token");
  }

  if (SCOPE_RANK[token.scope] < SCOPE_RANK[minScope]) {
    throw new ApiError(403, `Token scope '${token.scope}' cannot perform this action`);
  }

  return token;
}

export async function requireProjectAccess(
  auth: ApiAuth,
  projectId: string
) {
  if (auth.projectId && auth.projectId !== projectId) {
    throw new ApiError(403, "Token is scoped to a different project");
  }

  const project = await getProject(projectId, auth.organizationId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  return project;
}

export async function requireIssueAccess(auth: ApiAuth, issueId: string) {
  const issue = await getIssue(issueId);
  if (!issue) {
    throw new ApiError(404, "Issue not found");
  }

  await requireProjectAccess(auth, issue.projectId);
  return issue;
}

export function handleApiError(err: unknown) {
  if (err instanceof ApiError) {
    return jsonError(err.status, err.message);
  }
  console.error("[api/v1]", err);
  return jsonError(500, "Internal server error");
}
