import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgAdmin, requireOrgMember } from "@/lib/permissions";
import {
  listSsoConnections,
  createSsoConnection,
} from "@/lib/queries-sso";
import { recordAudit } from "@/lib/audit";

const createSchema = z.object({
  providerType: z.enum(["saml", "oidc"]),
  providerName: z.string().min(1).max(120),
  emailDomains: z.array(z.string().min(1).max(120)).min(1).max(20),
  metadata: z.record(z.string(), z.unknown()).default({}),
  enabled: z.boolean().default(true),
});

export async function GET() {
  try {
    const { organizationId } = await requireOrgMember();
    const connections = await listSsoConnections(organizationId);
    return NextResponse.json({ connections });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireOrgAdmin();
    const raw = (await request.json()) as unknown;
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const normalizedDomains = parsed.data.emailDomains.map((d) =>
      d.trim().toLowerCase().replace(/^@/, "")
    );
    const connection = await createSsoConnection({
      organizationId: ctx.organizationId,
      providerType: parsed.data.providerType,
      providerName: parsed.data.providerName.trim(),
      emailDomains: normalizedDomains,
      metadata: parsed.data.metadata,
      enabled: parsed.data.enabled,
    });
    await recordAudit({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "sso.configured",
      targetType: "sso_connection",
      targetId: connection.id,
      targetLabel: connection.providerName,
      metadata: {
        providerType: connection.providerType,
        emailDomains: connection.emailDomains,
        enabled: connection.enabled,
      },
    });
    return NextResponse.json(connection);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
