import { NextResponse } from "next/server";
import { getProject } from "@/lib/queries";
import { createUptimeMonitor, getMonitorSummaries } from "@/lib/uptime";
import { requireOrganizationId } from "@/lib/clerk-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const organizationId = await requireOrganizationId();
    const { id } = await params;
    const project = await getProject(id, organizationId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const summaries = await getMonitorSummaries(id);
    return NextResponse.json(summaries);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const organizationId = await requireOrganizationId();
    const { id } = await params;
    const project = await getProject(id, organizationId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      name?: string;
      url?: string;
      method?: string;
      intervalSeconds?: number;
      expectedStatus?: number;
      timeoutMs?: number;
      failureThreshold?: number;
    };

    const name = body.name?.trim();
    const url = body.url?.trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "A valid http(s) URL is required" }, { status: 400 });
    }

    const monitor = await createUptimeMonitor(id, {
      name,
      url,
      method: body.method,
      intervalSeconds: body.intervalSeconds,
      expectedStatus: body.expectedStatus,
      timeoutMs: body.timeoutMs,
      failureThreshold: body.failureThreshold,
    });

    return NextResponse.json(monitor, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
