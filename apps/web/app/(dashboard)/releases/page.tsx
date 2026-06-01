import { listOrgReleases } from "@/lib/queries-releases";
import { requireOrganizationId } from "@/lib/clerk-auth";
import { PageHeaderBar } from "@/components/page-header-bar";
import { ReleasesTable } from "@/components/releases-table";

export const dynamic = "force-dynamic";

export default async function OrgReleasesPage() {
  const organizationId = await requireOrganizationId();
  const releases = await listOrgReleases(organizationId, { limit: 100 });

  return (
    <main className="dash-page">
      <PageHeaderBar title="Releases" />

      <div className="fade-in" style={{ marginTop: 24, marginBottom: 24 }}>
        <p className="meta">
          Every release across all projects in this organization. Click into a release to see
          which issues first appeared there and detect regressions.
        </p>
      </div>

      <div className="fade-in">
        <ReleasesTable initialReleases={releases} showProject />
      </div>
    </main>
  );
}
