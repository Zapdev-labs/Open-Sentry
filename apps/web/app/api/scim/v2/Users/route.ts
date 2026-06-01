import { NextResponse } from "next/server";
import { and, eq, ilike, sql } from "drizzle-orm";
import { getDb, user, member } from "@sentry-clone/db";
import { authenticateScimRequest, scimError, scimJson } from "@/lib/scim-auth";

function userToScim(u: { id: string; email: string; name: string; createdAt: Date; updatedAt: Date }, baseUrl: string) {
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

export async function GET(request: Request) {
  const auth = await authenticateScimRequest(request);
  if (!auth) return scimError(401, "Invalid or missing SCIM bearer token");
  const baseUrl = new URL(request.url).origin;

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter");
  const startIndex = Math.max(parseInt(searchParams.get("startIndex") ?? "1", 10) || 1, 1);
  const count = Math.min(Math.max(parseInt(searchParams.get("count") ?? "50", 10) || 50, 1), 200);

  const conditions = [eq(member.organizationId, auth.organizationId)];
  if (filter) {
    const userNameMatch = /userName\s+eq\s+"([^"]+)"/i.exec(filter);
    if (userNameMatch && userNameMatch[1]) {
      conditions.push(ilike(user.email, userNameMatch[1]));
    }
  }

  const rows = await getDb()
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(...conditions))
    .limit(count)
    .offset(startIndex - 1);

  const totalRows = await getDb()
    .select({ total: sql<number>`count(*)::int` })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(...conditions));
  const total = totalRows[0]?.total ?? 0;

  return scimJson({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: total,
    itemsPerPage: rows.length,
    startIndex,
    Resources: rows.map((r) => userToScim(r, baseUrl)),
  });
}

export async function POST(request: Request) {
  const auth = await authenticateScimRequest(request);
  if (!auth) return scimError(401, "Invalid or missing SCIM bearer token");
  const baseUrl = new URL(request.url).origin;

  const body = (await request.json().catch(() => null)) as {
    userName?: string;
    emails?: Array<{ value?: string }>;
    name?: { givenName?: string; familyName?: string; formatted?: string };
    active?: boolean;
  } | null;
  if (!body) return scimError(400, "Invalid JSON body", "invalidSyntax");

  const email = (body.emails?.[0]?.value ?? body.userName ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return scimError(400, "Valid email (userName or emails[0].value) is required");
  }
  const name =
    body.name?.formatted?.trim() ||
    [body.name?.givenName, body.name?.familyName].filter(Boolean).join(" ").trim() ||
    email.split("@")[0]!;

  const db = getDb();
  const [existing] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  const userId = existing?.id ?? crypto.randomUUID();

  if (!existing) {
    await db.insert(user).values({
      id: userId,
      email,
      name,
      emailVerified: true,
    });
  } else {
    await db
      .update(user)
      .set({ name, updatedAt: new Date() })
      .where(eq(user.id, userId));
  }

  const [alreadyMember] = await db
    .select()
    .from(member)
    .where(and(eq(member.organizationId, auth.organizationId), eq(member.userId, userId)))
    .limit(1);
  if (!alreadyMember) {
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: auth.organizationId,
      userId,
      role: "member",
    });
  }

  const [row] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  if (!row) return scimError(500, "Failed to create user");
  return scimJson(userToScim(row, baseUrl), 201);
}
