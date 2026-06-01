import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganizationId } from "@/lib/clerk-auth";
import { getAlertChannel, listAlertRules } from "@/lib/queries-alerts";
import { PageHeaderBar } from "@/components/page-header-bar";
import { AlertChannelForm } from "@/components/alert-channel-edit-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAlertChannelPage({ params }: PageProps) {
  const organizationId = await requireOrganizationId();
  const { id } = await params;
  const channel = await getAlertChannel(id);
  if (!channel) notFound();

  const rules = await listAlertRules(organizationId);
  const linkedRules = rules.filter((r) => r.channelIds.includes(id));

  return (
    <main className="dash-page">
      <PageHeaderBar title={channel.name} />

      <div className="fade-in" style={{ marginTop: 24, marginBottom: 24 }}>
        <Link href="/alerts?tab=channels" className="meta" style={{ fontSize: 13 }}>
          ← Back to channels
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)", gap: 24 }}>
        <div className="card fade-in">
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Configuration</h2>
          <AlertChannelForm
            channel={{
              id: channel.id,
              name: channel.name,
              channelType: channel.channelType,
              enabled: channel.enabled,
              config: channel.config,
            }}
          />
        </div>

        <div>
          <div className="card fade-in">
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Linked rules</h3>
            {linkedRules.length === 0 ? (
              <p className="meta" style={{ fontSize: 13 }}>
                No rules use this channel yet.
              </p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {linkedRules.map((rule) => (
                  <li
                    key={rule.id}
                    style={{
                      padding: "8px 0",
                      borderBottom: "1px solid var(--dash-border)",
                      fontSize: 13,
                    }}
                  >
                    <Link
                      href={`/alerts/rules/${rule.id}`}
                      style={{ color: "inherit", textDecoration: "none", fontWeight: 500 }}
                    >
                      {rule.name}
                    </Link>
                    <p className="meta" style={{ fontSize: 12, margin: 0, marginTop: 2 }}>
                      {rule.ruleType} · {rule.thresholdCount} in {rule.thresholdWindow}m
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
