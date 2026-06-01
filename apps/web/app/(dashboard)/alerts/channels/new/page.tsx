import Link from "next/link";
import { requireOrganizationId } from "@/lib/clerk-auth";
import { listAlertChannels } from "@/lib/queries-alerts";
import { PageHeaderBar } from "@/components/page-header-bar";
import { CreateChannelForm } from "@/components/alert-forms";

export const dynamic = "force-dynamic";

export default async function NewAlertChannelPage() {
  const organizationId = await requireOrganizationId();
  const channels = await listAlertChannels(organizationId);
  void channels;

  return (
    <main className="dash-page">
      <PageHeaderBar title="New alert channel" />

      <div className="fade-in" style={{ marginTop: 24, marginBottom: 24 }}>
        <Link href="/alerts?tab=channels" className="meta" style={{ fontSize: 13 }}>
          ← Back to channels
        </Link>
      </div>

      <div className="card fade-in" style={{ maxWidth: 720 }}>
        <CreateChannelForm />
      </div>
    </main>
  );
}
