import { requireOrganizationId } from "@/lib/session-org";
import { listSsoConnections } from "@/lib/queries-sso";
import { PageHeaderBar } from "@/components/page-header-bar";
import { SsoView } from "@/components/sso-view";

export const dynamic = "force-dynamic";

export default async function SsoPage() {
  const organizationId = await requireOrganizationId();
  const connections = await listSsoConnections(organizationId);

  return (
    <main className="dash-page">
      <PageHeaderBar title="Single sign-on" />

      <div className="fade-in" style={{ marginTop: 24, marginBottom: 24 }}>
        <p className="meta">
          Configure SAML or OIDC providers to authenticate members via your identity provider.
          Members whose email matches a configured domain will be routed through SSO on sign-in.
        </p>
      </div>

      <div className="fade-in">
        <SsoView
          initialConnections={connections.map((c) => ({
            id: c.id,
            providerType: c.providerType,
            providerName: c.providerName,
            emailDomains: c.emailDomains,
            metadata: c.metadata as Record<string, unknown>,
            enabled: c.enabled,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
          }))}
        />
      </div>
    </main>
  );
}
