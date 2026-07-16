import { and, eq, ne, sql } from "drizzle-orm";
import { getDb } from "./index";
import { member, organization, user } from "./auth-schema";
import { projects } from "./schema";
import {
  alertChannels,
  alertRules,
  apiTokens,
  auditLog,
  retentionPolicies,
  scimTokens,
  ssoConnections,
} from "./schema-enterprise";

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

function isClerkUserId(id: string): boolean {
  return id.startsWith("user_");
}

function isClerkOrgId(id: string): boolean {
  return id.startsWith("org_");
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
    const base = clerkSlug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
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

/**
 * Better Auth left users with non-`user_` ids. Clerk sync inserts `user_…` with the
 * same email and hits `user_email_unique`. Remap FKs then replace the row.
 */
async function adoptLegacyUserByEmail(input: UserInput): Promise<void> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(user)
    .where(eq(user.email, input.email))
    .limit(1);

  if (!existing || existing.id === input.id) return;
  if (isClerkUserId(existing.id)) {
    // Different Clerk user already owns this email — leave as-is; insert will fail loudly.
    return;
  }

  const oldId = existing.id;
  const newId = input.id;

  await db.transaction(async (tx) => {
    const [already] = await tx.select().from(user).where(eq(user.id, newId)).limit(1);
    if (!already) {
      await tx
        .update(user)
        .set({ email: `${existing.email}.legacy.${oldId.slice(0, 8)}` })
        .where(eq(user.id, oldId));

      await tx.insert(user).values({
        id: newId,
        name: input.name || existing.name,
        email: input.email,
        emailVerified: input.emailVerified ?? existing.emailVerified,
        image: input.image ?? existing.image,
        createdAt: existing.createdAt,
        updatedAt: new Date(),
      });
    }

    await tx.update(member).set({ userId: newId }).where(eq(member.userId, oldId));
    await tx.execute(sql`UPDATE account SET user_id = ${newId} WHERE user_id = ${oldId}`);
    await tx.execute(sql`UPDATE session SET user_id = ${newId} WHERE user_id = ${oldId}`);
    await tx.execute(
      sql`UPDATE invitation SET inviter_id = ${newId} WHERE inviter_id = ${oldId}`
    );
    await tx
      .update(apiTokens)
      .set({ createdBy: newId })
      .where(eq(apiTokens.createdBy, oldId));
    await tx.update(auditLog).set({ actorId: newId }).where(eq(auditLog.actorId, oldId));
    await tx
      .update(alertRules)
      .set({ createdBy: newId })
      .where(eq(alertRules.createdBy, oldId));
    await tx
      .update(alertChannels)
      .set({ createdBy: newId })
      .where(eq(alertChannels.createdBy, oldId));

    await tx.delete(user).where(eq(user.id, oldId));
  });
}

/**
 * Move projects (and org-scoped rows) from legacy Better Auth orgs this user owned
 * onto their active Clerk organization so the dashboard is not empty.
 */
export async function adoptLegacyOrgsForClerkUser(
  clerkUserId: string,
  clerkOrgId: string
): Promise<number> {
  if (!isClerkUserId(clerkUserId) || !isClerkOrgId(clerkOrgId)) return 0;

  const db = getDb();
  const owned = await db
    .select({ organizationId: member.organizationId, role: member.role })
    .from(member)
    .where(eq(member.userId, clerkUserId));

  const legacyOrgIds = owned
    .filter((row) => !isClerkOrgId(row.organizationId))
    .filter((row) => row.role === "owner" || row.role === "admin")
    .map((row) => row.organizationId);

  if (legacyOrgIds.length === 0) return 0;

  let movedProjects = 0;

  await db.transaction(async (tx) => {
    for (const legacyOrgId of legacyOrgIds) {
      const updated = await tx
        .update(projects)
        .set({ organizationId: clerkOrgId })
        .where(eq(projects.organizationId, legacyOrgId))
        .returning({ id: projects.id });
      movedProjects += updated.length;

      await tx
        .update(apiTokens)
        .set({ organizationId: clerkOrgId })
        .where(eq(apiTokens.organizationId, legacyOrgId));
      await tx
        .update(auditLog)
        .set({ organizationId: clerkOrgId })
        .where(eq(auditLog.organizationId, legacyOrgId));
      await tx
        .update(alertRules)
        .set({ organizationId: clerkOrgId })
        .where(eq(alertRules.organizationId, legacyOrgId));
      await tx
        .update(alertChannels)
        .set({ organizationId: clerkOrgId })
        .where(eq(alertChannels.organizationId, legacyOrgId));
      await tx
        .update(retentionPolicies)
        .set({ organizationId: clerkOrgId })
        .where(eq(retentionPolicies.organizationId, legacyOrgId));
      await tx
        .update(ssoConnections)
        .set({ organizationId: clerkOrgId })
        .where(eq(ssoConnections.organizationId, legacyOrgId));
      await tx
        .update(scimTokens)
        .set({ organizationId: clerkOrgId })
        .where(eq(scimTokens.organizationId, legacyOrgId));

      // Drop legacy memberships for this user on the old org; Clerk membership is authoritative.
      await tx
        .delete(member)
        .where(
          and(eq(member.organizationId, legacyOrgId), eq(member.userId, clerkUserId))
        );

      // If no members remain, remove the legacy org shell.
      const remaining = await tx
        .select({ id: member.id })
        .from(member)
        .where(eq(member.organizationId, legacyOrgId))
        .limit(1);
      if (remaining.length === 0) {
        await tx.delete(organization).where(eq(organization.id, legacyOrgId));
      }
    }
  });

  return movedProjects;
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
  await adoptLegacyUserByEmail(input);

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

  // Also clear any duplicate membership row for same org+user under a different id.
  await db
    .delete(member)
    .where(
      and(
        eq(member.organizationId, input.organizationId),
        eq(member.userId, input.userId),
        ne(member.id, input.id)
      )
    );
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
