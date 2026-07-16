import Link from "next/link";
import { requireOrganizationId } from "@/lib/session-org";
import { listAlertChannels } from "@/lib/queries-alerts";
import { PageHeaderBar } from "@/components/page-header-bar";
import { CreateRuleForm, type AlertChannelOption } from "@/components/alert-forms";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function NewAlertRulePage({ searchParams }: PageProps) {
  const organizationId = await requireOrganizationId();
  const { projectId } = await searchParams;
  const channels = await listAlertChannels(organizationId);

  const options: AlertChannelOption[] = channels.map((c) => ({
    id: c.id,
    name: c.name,
    channelType: c.channelType,
    enabled: c.enabled,
  }));

  return (
    <main className="dash-page">
      <PageHeaderBar title="New alert rule" />

      <div className="fade-in" style={{ marginTop: 24, marginBottom: 24 }}>
        <Link href="/alerts" className="meta" style={{ fontSize: 13 }}>
          ← Back to alerts
        </Link>
      </div>

      <div className="card fade-in" style={{ maxWidth: 720 }}>
        <CreateRuleForm projectId={projectId ?? null} channels={options} />
      </div>
    </main>
  );
}
