import { notFound } from "next/navigation";
import { getProject } from "@/lib/queries";
import { listReleases } from "@/lib/queries-releases";
import { requireOrganizationId } from "@/lib/clerk-auth";
import { PageHeaderBar } from "@/components/page-header-bar";
import { ReleasesTable } from "@/components/releases-table";
import { CreateReleaseForm } from "@/components/create-release-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectReleasesPage({ params }: PageProps) {
  const { id } = await params;
  const organizationId = await requireOrganizationId();
  const project = await getProject(id, organizationId);
  if (!project) notFound();

  const releases = await listReleases(id);

  return (
    <main className="dash-page">
      <PageHeaderBar
        title="Releases"
        children={<CreateReleaseForm projectId={id} />}
      />

      <div className="fade-in" style={{ marginTop: 24, marginBottom: 24 }}>
        <p className="meta">
          Track which issues first appeared in each deployment, and automatically detect
          regressions — issues that were resolved and reappeared after a new release shipped.
        </p>
      </div>

      <div className="fade-in" style={{ marginBottom: 24 }}>
        <ReleasesTable projectId={id} initialReleases={releases} />
      </div>
    </main>
  );
}
