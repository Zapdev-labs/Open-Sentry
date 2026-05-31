import { auth } from "@/lib/auth";
import { headers } from "next/headers";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function ensureActiveOrganization() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return null;

  const activeOrgId = session.session.activeOrganizationId;
  if (activeOrgId) {
    return { session, organizationId: activeOrgId };
  }

  const orgs = await auth.api.listOrganizations({ headers: requestHeaders });
  if (orgs.length > 0) {
    const firstOrg = orgs[0];
    if (!firstOrg) return { session, organizationId: "" };
    const organizationId = firstOrg.id;
    await auth.api.setActiveOrganization({
      headers: requestHeaders,
      body: { organizationId },
    });
    return { session, organizationId };
  }

  const baseSlug = slugify(session.user.name || session.user.email.split("@")[0] || "workspace");
  const slug = `${baseSlug}-${session.user.id.slice(0, 6)}`;
  const org = await auth.api.createOrganization({
    headers: requestHeaders,
    body: {
      name: `${session.user.name}'s Workspace`,
      slug,
    },
  });

  return { session, organizationId: org.id };
}

export async function requireOrganizationId(): Promise<string> {
  const result = await ensureActiveOrganization();
  if (!result) {
    throw new Error("Unauthorized");
  }
  return result.organizationId;
}
