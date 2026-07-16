import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getDb, member } from "@sentry-clone/db";
import { eq, and } from "drizzle-orm";

export const ORG_ROLES = ["owner", "admin", "member"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export type OrgContext = {
  organizationId: string;
  role: OrgRole;
  userId: string;
};

/**
 * Resolve the caller's role in the active organization.
 * Returns null if there is no active session, no active org, or the user is not a member.
 */
export async function getOrgRole(): Promise<OrgContext | null> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.session.activeOrganizationId) return null;

  const organizationId = session.session.activeOrganizationId;
  const [row] = await getDb()
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, session.user.id)))
    .limit(1);

  if (!row) return null;
  return {
    organizationId,
    role: (row.role as OrgRole) ?? "member",
    userId: session.user.id,
  };
}

/**
 * Throw if the caller is not an admin (or owner) of the active organization.
 * Returns the resolved { organizationId, role, userId } on success.
 */
export async function requireOrgAdmin(): Promise<OrgContext> {
  const context = await getOrgRole();
  if (!context) throw new Error("Unauthorized");
  if (context.role !== "admin" && context.role !== "owner") {
    throw new Error("Forbidden: admin role required");
  }
  return context;
}

/**
 * Throw if the caller is not a member of the active organization.
 */
export async function requireOrgMember(): Promise<OrgContext> {
  const context = await getOrgRole();
  if (!context) throw new Error("Unauthorized");
  return context;
}

/**
 * Returns true if the caller has at least the required role.
 * "owner" satisfies everything; "admin" satisfies "admin" and "member"; "member" only "member".
 */
export function roleSatisfies(actual: OrgRole, required: OrgRole): boolean {
  const rank: Record<OrgRole, number> = { member: 0, admin: 1, owner: 2 };
  return rank[actual] >= rank[required];
}
