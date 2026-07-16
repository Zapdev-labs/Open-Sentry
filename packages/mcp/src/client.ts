export class OpenSentryApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown
  ) {
    super(message);
    this.name = "OpenSentryApiError";
  }
}

export interface OpenSentryClientOptions {
  baseUrl: string;
  token: string;
}

export class OpenSentryClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(options: OpenSentryClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = text;
      }
    }

    if (!response.ok) {
      const message =
        typeof parsed === "object" &&
        parsed !== null &&
        "error" in parsed &&
        typeof (parsed as { error: unknown }).error === "string"
          ? (parsed as { error: string }).error
          : `Open Sentry API error (${response.status})`;
      throw new OpenSentryApiError(response.status, message, parsed);
    }

    return parsed as T;
  }

  me() {
    return this.request<{
      organizationId: string;
      projectId: string | null;
      scope: string;
      name: string;
      lastFour: string;
      expiresAt: string | null;
    }>("GET", "/api/v1/me");
  }

  orgStats() {
    return this.request<Record<string, number>>("GET", "/api/v1/org/stats");
  }

  orgActivity(limit?: number) {
    const q = limit ? `?limit=${limit}` : "";
    return this.request<{ activity: unknown[] }>("GET", `/api/v1/org/activity${q}`);
  }

  listProjects() {
    return this.request<{ projects: unknown[] }>("GET", "/api/v1/projects");
  }

  createProject(name: string) {
    return this.request<{ project: unknown }>("POST", "/api/v1/projects", { name });
  }

  getProject(projectId: string) {
    return this.request<{ project: unknown; overview: unknown }>(
      "GET",
      `/api/v1/projects/${projectId}`
    );
  }

  listIssues(projectId: string, filters?: { status?: string; level?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.level) params.set("level", filters.level);
    const q = params.toString() ? `?${params}` : "";
    return this.request<{ issues: unknown[] }>(
      "GET",
      `/api/v1/projects/${projectId}/issues${q}`
    );
  }

  getIssue(issueId: string) {
    return this.request<{ issue: unknown }>("GET", `/api/v1/issues/${issueId}`);
  }

  updateIssue(issueId: string, status: "open" | "resolved" | "ignored") {
    return this.request<{ issue: unknown }>("PATCH", `/api/v1/issues/${issueId}`, {
      status,
    });
  }

  listIssueEvents(issueId: string, options?: { cursor?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (options?.cursor) params.set("cursor", options.cursor);
    if (options?.limit) params.set("limit", String(options.limit));
    const q = params.toString() ? `?${params}` : "";
    return this.request<{ events: unknown[]; timeline: unknown[] }>(
      "GET",
      `/api/v1/issues/${issueId}/events${q}`
    );
  }

  getPerformance(projectId: string, limit?: number) {
    const q = limit ? `?limit=${limit}` : "";
    return this.request<{ stats: unknown; transactions: unknown[] }>(
      "GET",
      `/api/v1/projects/${projectId}/performance${q}`
    );
  }

  getAi(projectId: string, limit?: number) {
    const q = limit ? `?limit=${limit}` : "";
    return this.request<{
      stats: unknown;
      today: unknown;
      byModel: unknown[];
      generations: unknown[];
    }>("GET", `/api/v1/projects/${projectId}/ai${q}`);
  }

  listAlertRules(projectId?: string) {
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    return this.request<{ rules: unknown[] }>("GET", `/api/v1/alerts/rules${q}`);
  }
}
