import { requireOrganizationId } from "@/lib/clerk-auth";
import { PageHeaderBar } from "@/components/page-header-bar";
import { ApiTokensView } from "@/components/api-tokens-view";
import { listApiTokens } from "@/lib/queries-tokens";

export const dynamic = "force-dynamic";

export default async function TokensPage() {
  const organizationId = await requireOrganizationId();
  const tokens = await listApiTokens(organizationId);

  return (
    <main className="dash-page">
      <PageHeaderBar title="API tokens" />

      <div className="fade-in" style={{ marginTop: 24, marginBottom: 24 }}>
        <p className="meta">
          Tokens authenticate the management API and SDK installs for non-DSN workflows (releases,
          source maps, custom integrations). Treat them like passwords — they're shown once at
          creation.
        </p>
      </div>

      <ApiTokensView initialTokens={tokens} />
    </main>
  );
}
