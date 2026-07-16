import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ensureOrganizationInDb } from "@/lib/clerk-org-sync";

export const ORG_ROLES = ["owner", "admin", "member"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export type OrgContext = {
  organizationId: string;
  role: OrgRole;
  userId: string;
};

async function syncActiveOrgToDb(userId: string, orgId: string, orgRole?: string | null) {
  await ensureOrganizationInDb({
    organizationId: orgId,
    userId,
    orgRole: orgRole ?? undefined,
  });
}

export async function getOrgRole(): Promise<OrgContext | null> {
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId || !orgRole) return null;

  await syncActiveOrgToDb(userId, orgId, orgRole);

  return {
    organizationId: orgId,
    role: clerkRoleToOrgRole(orgRole),
    userId,
  };
}

export async function requireOrgAdmin(): Promise<OrgContext> {
  const context = await getOrgRole();
  if (!context) throw new Error("Unauthorized");
  if (context.role !== "admin" && context.role !== "owner") {
    throw new Error("Forbidden: admin role required");
  }
  return context;
}

export async function requireOrgMember(): Promise<OrgContext> {
  const context = await getOrgRole();
  if (!context) throw new Error("Unauthorized");
  return context;
}

export async function requireOrganizationId(): Promise<string> {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) throw new Error("Unauthorized");
  if (!orgId) throw new Error("No active organization");
  await syncActiveOrgToDb(userId, orgId, orgRole);
  return orgId;
}

function clerkRoleToOrgRole(clerkRole: string): OrgRole {
  if (clerkRole === "org:admin" || clerkRole === "admin:org") return "admin";
  if (clerkRole.endsWith(":owner") || clerkRole === "owner") return "owner";
  return "member";
}

export function roleSatisfies(actual: OrgRole, required: OrgRole): boolean {
  const rank: Record<OrgRole, number> = { member: 0, admin: 1, owner: 2 };
  return rank[actual] >= rank[required];
}

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

export async function listOrgMembers() {
  const { orgId } = await auth();
  if (!orgId) return [];
  const client = await clerkClient();
  const memberships = await client.organizations.getOrganizationMembershipList({
    organizationId: orgId,
  });
  return memberships.data;
}

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
 * Ensure the caller has an active organization.
 * Redirects to org onboarding when signed in but no org is selected/created.
 */
export async function ensureActiveOrganization(): Promise<string> {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) redirect("/login");
  if (!orgId) redirect("/onboarding");
  await syncActiveOrgToDb(userId, orgId, orgRole);
  return orgId;
}
