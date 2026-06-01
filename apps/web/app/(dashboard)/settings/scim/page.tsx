import { requireOrganizationId } from "@/lib/session-org";
import { listScimTokens } from "@/lib/queries-scim";
import { PageHeaderBar } from "@/components/page-header-bar";
import { ScimView } from "@/components/scim-view";

export const dynamic = "force-dynamic";

export default async function ScimPage() {
  const organizationId = await requireOrganizationId();
  const tokens = await listScimTokens(organizationId);

  return (
    <main className="dash-page">
      <PageHeaderBar title="SCIM provisioning" />

      <div className="fade-in" style={{ marginTop: 24, marginBottom: 24 }}>
        <p className="meta">
          Issue SCIM tokens for your identity provider (Okta, Azure AD, Google Workspace, etc.) to
          automatically provision and de-provision members. Tokens authenticate requests to the
          SCIM v2 endpoints and are shown once at creation.
        </p>
      </div>

      <div className="fade-in">
        <ScimView
          initialTokens={tokens.map((t) => ({
            id: t.id,
            label: t.label,
            lastFour: t.lastFour,
            status: t.status,
            createdBy: t.createdBy,
            lastUsedAt: t.lastUsedAt,
            revokedAt: t.revokedAt,
            createdAt: t.createdAt,
          }))}
        />
      </div>
    </main>
  );
}
