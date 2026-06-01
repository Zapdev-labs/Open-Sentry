import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgAdmin, requireOrgMember } from "@/lib/permissions";
import { createScimToken, listScimTokens } from "@/lib/queries-scim";
import { issueScimToken } from "@/lib/scim-auth";
import { recordAudit } from "@/lib/audit";

const createSchema = z.object({
  label: z.string().min(1).max(80),
});

export async function GET() {
  try {
    const { organizationId } = await requireOrgMember();
    const tokens = await listScimTokens(organizationId);
    return NextResponse.json({ tokens });
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
    const issued = issueScimToken();
    const token = await createScimToken({
      organizationId: ctx.organizationId,
      label: parsed.data.label.trim(),
      tokenHash: issued.hash,
      lastFour: issued.lastFour,
      createdBy: ctx.userId,
    });
    await recordAudit({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "scim.token_created",
      targetType: "scim_token",
      targetId: token.id,
      targetLabel: token.label,
    });
    return NextResponse.json({
      token: { ...token, tokenHash: undefined },
      plaintext: issued.plaintext,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
