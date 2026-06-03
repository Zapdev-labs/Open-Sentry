import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import {
  deleteMemberById,
  deleteMemberByOrgUser,
  deleteOrganization,
  displayNameFromClerkUser,
  getDb,
  getOrganizationById,
  slugForOrganization,
  upsertMember,
  upsertOrganization,
  upsertUser,
  user,
} from "@sentry-clone/db";
import { eq } from "drizzle-orm";
import {
  mapClerkWebhookRole,
  syncAllOrganizationMembers,
  syncClerkOrganizationToDb,
  syncClerkUserToDb,
} from "@/lib/clerk-org-sync";

type ClerkEmailAddress = {
  id: string;
  email_address: string;
  verification?: { status?: string };
};

type ClerkUserPayload = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  image_url?: string | null;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string | null;
};

type ClerkOrgPayload = {
  id: string;
  name: string;
  slug?: string | null;
  image_url?: string | null;
  created_at?: number;
};

type ClerkMembershipPayload = {
  id: string;
  role?: string;
  organization?: { id: string };
  organization_id?: string;
  public_user_data?: { user_id?: string };
  public_user_id?: string;
};

function primaryEmailFromPayload(u: ClerkUserPayload): string {
  const emails = u.email_addresses ?? [];
  const primary = emails.find((e) => e.id === u.primary_email_address_id);
  return primary?.email_address ?? emails[0]?.email_address ?? `${u.id}@users.clerk`;
}

async function handleUserEvent(data: ClerkUserPayload): Promise<void> {
  const email = primaryEmailFromPayload(data);
  const primary = data.email_addresses?.find((e) => e.id === data.primary_email_address_id);
  await upsertUser({
    id: data.id,
    name: displayNameFromClerkUser({
      firstName: data.first_name,
      lastName: data.last_name,
      username: data.username,
      email,
    }),
    email,
    emailVerified: primary?.verification?.status === "verified",
    image: data.image_url ?? null,
  });
}

async function handleOrganizationEvent(data: ClerkOrgPayload): Promise<void> {
  await upsertOrganization({
    id: data.id,
    name: data.name,
    slug: slugForOrganization(data.id, data.name, data.slug),
    logo: data.image_url ?? null,
    createdAt: data.created_at ? new Date(data.created_at) : undefined,
  });
}

function membershipOrgId(data: ClerkMembershipPayload): string | null {
  return data.organization?.id ?? data.organization_id ?? null;
}

function membershipUserId(data: ClerkMembershipPayload): string | null {
  return data.public_user_data?.user_id ?? data.public_user_id ?? null;
}

async function handleMembershipUpsert(data: ClerkMembershipPayload): Promise<void> {
  const organizationId = membershipOrgId(data);
  const userId = membershipUserId(data);
  if (!organizationId || !userId) return;
  if (!(await getOrganizationById(organizationId))) {
    await syncClerkOrganizationToDb(organizationId);
  }
  await syncClerkUserToDb(userId);
  await upsertMember({
    id: data.id,
    organizationId,
    userId,
    role: mapClerkWebhookRole(data.role),
  });
}

export async function POST(req: NextRequest) {
  let event: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    event = await verifyWebhook(req);
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated":
        await handleUserEvent(event.data as ClerkUserPayload);
        break;
      case "user.deleted": {
        const data = event.data as { id?: string };
        if (data.id) {
          await getDb().delete(user).where(eq(user.id, data.id));
        }
        break;
      }
      case "organization.created":
        await handleOrganizationEvent(event.data as ClerkOrgPayload);
        await syncAllOrganizationMembers((event.data as ClerkOrgPayload).id);
        break;
      case "organization.updated":
        await handleOrganizationEvent(event.data as ClerkOrgPayload);
        break;
      case "organization.deleted": {
        const data = event.data as { id?: string };
        if (data.id) await deleteOrganization(data.id);
        break;
      }
      case "organizationMembership.created":
      case "organizationMembership.updated":
        await handleMembershipUpsert(event.data as ClerkMembershipPayload);
        break;
      case "organizationMembership.deleted": {
        const data = event.data as ClerkMembershipPayload;
        if (data.id) {
          await deleteMemberById(data.id);
        } else {
          const organizationId = membershipOrgId(data);
          const userId = membershipUserId(data);
          if (organizationId && userId) {
            await deleteMemberByOrgUser(organizationId, userId);
          }
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("Clerk webhook handler error:", err);
    return new Response("Webhook handler failed", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
