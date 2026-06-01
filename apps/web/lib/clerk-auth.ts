import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

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
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId || !orgRole) return null;

  return {
    organizationId: orgId,
    role: clerkRoleToOrgRole(orgRole),
    userId,
  };
}

/**
 * Throw if the caller is not an admin (or owner) of the active organization.
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
 * Returns the active organization ID. Throws if no active session or org.
 */
export async function requireOrganizationId(): Promise<string> {
  const { userId, orgId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  if (!orgId) throw new Error("No active organization");
  return orgId;
}

/**
 * Map a Clerk org role string ("org:admin" | "org:member") to our OrgRole type.
 */
function clerkRoleToOrgRole(clerkRole: string): OrgRole {
  if (clerkRole === "org:admin" || clerkRole === "admin:org") return "admin";
  if (clerkRole.endsWith(":owner") || clerkRole === "owner") return "owner";
  return "member";
}

/**
 * Returns true if the caller has at least the required role.
 */
export function roleSatisfies(actual: OrgRole, required: OrgRole): boolean {
  const rank: Record<OrgRole, number> = { member: 0, admin: 1, owner: 2 };
  return rank[actual] >= rank[required];
}

/**
 * Get the current user from Clerk (for audit logging).
 */
export async function getActorContext() {
  const user = await currentUser();
  return {
    actorId: user?.id ?? null,
    actorEmail: user?.emailAddresses[0]?.emailAddress ?? null,
    actorName: user?.firstName
      ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
      : user?.username ?? null,
  };
}

/**
 * List all members of the active organization.
 */
export async function listOrgMembers() {
  const { orgId } = await auth();
  if (!orgId) return [];
  const client = await clerkClient();
  const memberships = await client.organizations.getOrganizationMembershipList({
    organizationId: orgId,
  });
  return memberships.data;
}

/**
 * Invite a user to the active organization by email.
 */
export async function inviteToOrg(email: string, role: "admin" | "member" = "member") {
  const { orgId } = await auth();
  if (!orgId) throw new Error("No active organization");
  const client = await clerkClient();
  await client.organizations.createOrganizationInvitation({
    organizationId: orgId,
    emailAddress: email,
    role: role === "admin" ? "org:admin" : "org:member",
  });
}

/**
 * Ensure the caller has an active organization. Redirects to org creation if not.
 * Use in server components/pages that require an org context.
 */
export async function ensureActiveOrganization(): Promise<string> {
  const { userId, orgId } = await auth();
  if (!userId) notFound();
  if (!orgId) notFound();
  return orgId;
}
