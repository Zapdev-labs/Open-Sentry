import { and, eq } from "drizzle-orm";
import { getDb } from "./index";
import { member, organization, user } from "./auth-schema";

export type OrgRole = "owner" | "admin" | "member";

export interface OrganizationInput {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  metadata?: string | null;
  createdAt?: Date;
}

export interface UserInput {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string | null;
}

export interface MemberInput {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
}

export function clerkRoleToOrgRole(clerkRole: string): OrgRole {
  if (clerkRole === "org:admin" || clerkRole === "admin:org") return "admin";
  if (clerkRole.endsWith(":owner") || clerkRole === "owner" || clerkRole === "org:owner") {
    return "owner";
  }
  return "member";
}

export function slugForOrganization(id: string, name: string, clerkSlug?: string | null): string {
  if (clerkSlug?.trim()) {
    const base = clerkSlug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (base.length >= 2) return base.slice(0, 60);
  }
  const fromName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = id.replace(/[^a-z0-9]/gi, "").slice(-8).toLowerCase() || "org";
  if (fromName.length >= 2) return `${fromName}-${suffix}`.slice(0, 60);
  return `org-${suffix}`.slice(0, 60);
}

export function displayNameFromClerkUser(parts: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
}): string {
  const full = [parts.firstName, parts.lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (parts.username?.trim()) return parts.username.trim();
  if (parts.email?.trim()) return parts.email.trim();
  return "User";
}

export async function upsertOrganization(input: OrganizationInput): Promise<void> {
  const db = getDb();
  await db
    .insert(organization)
    .values({
      id: input.id,
      name: input.name,
      slug: input.slug,
      logo: input.logo ?? null,
      metadata: input.metadata ?? null,
      createdAt: input.createdAt,
    })
    .onConflictDoUpdate({
      target: organization.id,
      set: {
        name: input.name,
        slug: input.slug,
        logo: input.logo ?? null,
        metadata: input.metadata ?? null,
      },
    });
}

export async function upsertUser(input: UserInput): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db
    .insert(user)
    .values({
      id: input.id,
      name: input.name,
      email: input.email,
      emailVerified: input.emailVerified ?? false,
      image: input.image ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: user.id,
      set: {
        name: input.name,
        email: input.email,
        emailVerified: input.emailVerified ?? false,
        image: input.image ?? null,
        updatedAt: now,
      },
    });
}

export async function upsertMember(input: MemberInput): Promise<void> {
  const db = getDb();
  await db
    .insert(member)
    .values({
      id: input.id,
      organizationId: input.organizationId,
      userId: input.userId,
      role: input.role,
    })
    .onConflictDoUpdate({
      target: member.id,
      set: { role: input.role },
    });
}

export async function deleteOrganization(organizationId: string): Promise<void> {
  const db = getDb();
  await db.delete(organization).where(eq(organization.id, organizationId));
}

export async function deleteMemberById(memberId: string): Promise<void> {
  const db = getDb();
  await db.delete(member).where(eq(member.id, memberId));
}

export async function deleteMemberByOrgUser(
  organizationId: string,
  userId: string
): Promise<void> {
  const db = getDb();
  await db
    .delete(member)
    .where(
      and(eq(member.organizationId, organizationId), eq(member.userId, userId))
    );
}

export async function getOrganizationById(
  organizationId: string
): Promise<typeof organization.$inferSelect | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  return row ?? null;
}

export async function listMembersForOrganization(organizationId: string) {
  const db = getDb();
  return db
    .select({
      member,
      user,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, organizationId));
}
