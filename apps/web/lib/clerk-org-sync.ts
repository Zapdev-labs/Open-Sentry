import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import {
  clerkRoleToOrgRole,
  displayNameFromClerkUser,
  getOrganizationById,
  slugForOrganization,
  upsertMember,
  upsertOrganization,
  upsertUser,
  type OrgRole,
} from "@sentry-clone/db";

function primaryEmail(
  userId: string,
  user: {
    emailAddresses?: Array<{ id: string; emailAddress: string }>;
    primaryEmailAddressId?: string | null;
  }
): string {
  const emails = user.emailAddresses ?? [];
  const primary = emails.find((e) => e.id === user.primaryEmailAddressId);
  return primary?.emailAddress ?? emails[0]?.emailAddress ?? `${userId}@users.clerk`;
}

export async function syncClerkUserToDb(userId: string): Promise<void> {
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  await upsertUser({
    id: clerkUser.id,
    name: displayNameFromClerkUser({
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      username: clerkUser.username,
      email: primaryEmail(clerkUser.id, clerkUser),
    }),
    email: primaryEmail(clerkUser.id, clerkUser),
    emailVerified:
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
        ?.verification?.status === "verified",
    image: clerkUser.imageUrl,
  });
}

export async function syncClerkOrganizationToDb(organizationId: string): Promise<void> {
  const client = await clerkClient();
  const org = await client.organizations.getOrganization({ organizationId });
  await upsertOrganization({
    id: org.id,
    name: org.name,
    slug: slugForOrganization(org.id, org.name, org.slug),
    logo: org.imageUrl,
    createdAt: new Date(org.createdAt),
  });
}

export async function syncClerkMembershipToDb(
  organizationId: string,
  userId: string,
  role: string,
  membershipId?: string
): Promise<void> {
  const client = await clerkClient();
  const memberId =
    membershipId ??
    (
      await client.organizations.getOrganizationMembershipList({
        organizationId,
        limit: 100,
      })
    ).data.find((m) => m.publicUserData?.userId === userId)?.id;

  if (!memberId) return;

  await syncClerkUserToDb(userId);
  await upsertMember({
    id: memberId,
    organizationId,
    userId,
    role: clerkRoleToOrgRole(role),
  });
}

/**
 * Ensure the active Clerk org (and optional current member) exist in Postgres.
 * Called on authenticated dashboard/API requests.
 */
export async function ensureOrganizationInDb(options: {
  organizationId: string;
  userId?: string;
  orgRole?: string;
}): Promise<void> {
  const existing = await getOrganizationById(options.organizationId);
  if (!existing) {
    await syncClerkOrganizationToDb(options.organizationId);
  }

  if (options.userId && options.orgRole) {
    await syncClerkMembershipToDb(
      options.organizationId,
      options.userId,
      options.orgRole
    );
  }
}

export async function syncAllOrganizationMembers(organizationId: string): Promise<void> {
  await syncClerkOrganizationToDb(organizationId);
  const client = await clerkClient();
  let offset = 0;
  const limit = 100;
  for (;;) {
    const page = await client.organizations.getOrganizationMembershipList({
      organizationId,
      limit,
      offset,
    });
    for (const m of page.data) {
      const userId = m.publicUserData?.userId;
      if (!userId) continue;
      await syncClerkUserToDb(userId);
      await upsertMember({
        id: m.id,
        organizationId,
        userId,
        role: clerkRoleToOrgRole(m.role),
      });
    }
    if (page.data.length < limit) break;
    offset += limit;
  }
}

export function mapClerkWebhookRole(role: string | undefined): OrgRole {
  if (!role) return "member";
  return clerkRoleToOrgRole(role);
}
