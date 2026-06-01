import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, user, member } from "@sentry-clone/db";
import { authenticateScimRequest, scimError, scimJson } from "@/lib/scim-auth";

function userToScim(
  u: { id: string; email: string; name: string; createdAt: Date; updatedAt: Date },
  baseUrl: string
) {
  return {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:User"],
    id: u.id,
    userName: u.email,
    name: { formatted: u.name, givenName: u.name, familyName: "" },
    emails: [{ value: u.email, primary: true, type: "work" }],
    active: true,
    meta: {
      resourceType: "User",
      created: new Date(u.createdAt).toISOString(),
      lastModified: new Date(u.updatedAt).toISOString(),
      location: `${baseUrl}/api/scim/v2/Users/${u.id}`,
    },
  };
}

async function findMemberUser(userId: string, organizationId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .innerJoin(member, eq(member.userId, user.id))
    .where(and(eq(user.id, userId), eq(member.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateScimRequest(request);
  if (!auth) return scimError(401, "Invalid or missing SCIM bearer token");
  const { id } = await params;
  const baseUrl = new URL(request.url).origin;
  const row = await findMemberUser(id, auth.organizationId);
  if (!row) return scimError(404, "User not found");
  return scimJson(userToScim(row, baseUrl));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateScimRequest(request);
  if (!auth) return scimError(401, "Invalid or missing SCIM bearer token");
  const { id } = await params;
  const baseUrl = new URL(request.url).origin;

  const row = await findMemberUser(id, auth.organizationId);
  if (!row) return scimError(404, "User not found");

  const body = (await request.json().catch(() => null)) as {
    name?: { formatted?: string; givenName?: string; familyName?: string };
    emails?: Array<{ value?: string }>;
    active?: boolean;
  } | null;
  if (!body) return scimError(400, "Invalid JSON body", "invalidSyntax");

  const updates: { name?: string; email?: string } = {};
  if (body.name) {
    const next =
      body.name.formatted?.trim() ||
      [body.name.givenName, body.name.familyName].filter(Boolean).join(" ").trim();
    if (next) updates.name = next;
  }
  if (body.emails?.[0]?.value) {
    updates.email = body.emails[0].value.trim().toLowerCase();
  }

  if (Object.keys(updates).length > 0) {
    await getDb()
      .update(user)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(user.id, id));
  }

  // Re-fetch
  const [updated] = await getDb()
    .select()
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  if (!updated) return scimError(404, "User not found");
  return scimJson(userToScim(updated, baseUrl));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateScimRequest(request);
  if (!auth) return scimError(401, "Invalid or missing SCIM bearer token");
  const { id } = await params;

  const result = await getDb()
    .delete(member)
    .where(and(eq(member.userId, id), eq(member.organizationId, auth.organizationId)))
    .returning({ id: member.id });
  if (result.length === 0) return scimError(404, "User not found");
  return new Response(null, { status: 204 });
}
