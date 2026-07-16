import { headers as nextHeaders } from "next/headers";
import { getDb, auditLog, type AuditLogEntry } from "@sentry-clone/db";
import { auth } from "@/lib/auth";

export type AuditAction = AuditLogEntry["action"];

export interface AuditOptions {
  organizationId: string;
  action: AuditAction;
  /** Optional actor override. Pass both `actorId` and `actorEmail`, or neither — a partial override falls back to a session lookup. */
  actorId?: string;
  actorEmail?: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  metadata?: Record<string, unknown>;
}

interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

interface ActorContext {
  actorId: string | null;
  actorEmail: string | null;
}

async function resolveRequestContext(): Promise<RequestContext> {
  const requestHeaders = await nextHeaders();
  const ipAddress =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    requestHeaders.get("x-real-ip") ??
    null;
  const userAgent = requestHeaders.get("user-agent") ?? null;
  return { ipAddress, userAgent };
}

async function resolveActorContext(): Promise<ActorContext> {
  const requestHeaders = await nextHeaders();
  const session = await auth.api.getSession({ headers: requestHeaders });
  return {
    actorId: session?.user.id ?? null,
    actorEmail: session?.user.email ?? null,
  };
}

/**
 * Append a row to the org audit log. Fire-and-await; never throw to the caller
 * (an audit write failure should not roll back a successful user action, but
 * should be surfaced via console.error so operators can see it).
 */
export async function recordAudit(options: AuditOptions): Promise<void> {
  try {
    const requestCtx = await resolveRequestContext();
    const actor: ActorContext =
      options.actorId !== undefined
        ? { actorId: options.actorId, actorEmail: options.actorEmail ?? null }
        : await resolveActorContext();

    await getDb().insert(auditLog).values({
      organizationId: options.organizationId,
      actorId: actor.actorId,
      actorEmail: actor.actorEmail,
      action: options.action,
      targetType: options.targetType ?? null,
      targetId: options.targetId ?? null,
      targetLabel: options.targetLabel ?? null,
      metadata: options.metadata ?? {},
      ipAddress: requestCtx.ipAddress,
      userAgent: requestCtx.userAgent,
    });
  } catch (err) {
    console.error("[audit] failed to write audit log entry", err);
  }
}
