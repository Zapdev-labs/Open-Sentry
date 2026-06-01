import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgAdmin, requireOrgMember } from "@/lib/clerk-auth";
import { createApiToken, listApiTokens } from "@/lib/queries-tokens";
import { recordAudit } from "@/lib/audit";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  scope: z.enum(["read", "write", "admin"]).default("read"),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function GET() {
  try {
    const { organizationId } = await requireOrgMember();
    const tokens = await listApiTokens(organizationId);
    return NextResponse.json({ tokens });
  } catch (err) {
    const status = err instanceof Error && err.message.startsWith("Forbidden") ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await requireOrgAdmin();

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
    }
    const { name, scope, expiresAt } = parsed.data;

    const result = await createApiToken({
      organizationId,
      name,
      scope,
      createdBy: userId,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    await recordAudit({
      organizationId,
      actorId: userId,
      action: "api_token.created",
      targetType: "api_token",
      targetId: result.token.id,
      targetLabel: name,
      metadata: { scope, lastFour: result.token.lastFour },
    });

    return NextResponse.json(
      { token: result.token, plaintext: result.plaintext },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
