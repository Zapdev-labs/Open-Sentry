import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getDb, member } from "@sentry-clone/db";
import { authenticateScimRequest, scimJson } from "@/lib/scim-auth";

const ROLE_GROUPS: Array<{ id: string; display: string; role: string }> = [
  { id: "role-owner", display: "Owners", role: "owner" },
  { id: "role-admin", display: "Admins", role: "admin" },
  { id: "role-member", display: "Members", role: "member" },
];

function groupToScim(g: { id: string; display: string }, baseUrl: string) {
  return {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:Group"],
    id: g.id,
    displayName: g.display,
    meta: {
      resourceType: "Group",
      location: `${baseUrl}/api/scim/v2/Groups/${g.id}`,
    },
  };
}

export async function GET(request: Request) {
  const auth = await authenticateScimRequest(request);
  if (!auth) return scimError401();
  const baseUrl = new URL(request.url).origin;

  const db = getDb();
  const counts = await db
    .select({ role: member.role, total: sql<number>`count(*)::int` })
    .from(member)
    .where(eq(member.organizationId, auth.organizationId))
    .groupBy(member.role);
  const countMap = new Map(counts.map((c) => [c.role, c.total]));

  return scimJson({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: ROLE_GROUPS.length,
    itemsPerPage: ROLE_GROUPS.length,
    startIndex: 1,
    Resources: ROLE_GROUPS.map((g) => ({
      ...groupToScim(g, baseUrl),
      members: countMap.get(g.role) ?? 0,
    })),
  });
}

function scimError401() {
  return new Response(
    JSON.stringify({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      detail: "Invalid or missing SCIM bearer token",
      status: 401,
    }),
    { status: 401, headers: { "Content-Type": "application/scim+json" } }
  );
}
