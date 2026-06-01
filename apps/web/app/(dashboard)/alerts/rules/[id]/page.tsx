import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganizationId } from "@/lib/clerk-auth";
import { getAlertRule, listAlertChannels, listAlertDeliveries } from "@/lib/queries-alerts";
import { PageHeaderBar } from "@/components/page-header-bar";
import { AlertRuleForm } from "@/components/alert-rule-edit-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAlertRulePage({ params }: PageProps) {
  const organizationId = await requireOrganizationId();
  const { id } = await params;
  const rule = await getAlertRule(id);
  if (!rule) notFound();

  const [channels, deliveries] = await Promise.all([
    listAlertChannels(organizationId),
    listAlertDeliveries({ organizationId, ruleId: id, limit: 20 }),
  ]);

  return (
    <main className="dash-page">
      <PageHeaderBar title={rule.name} />

      <div className="fade-in" style={{ marginTop: 24, marginBottom: 24 }}>
        <Link href="/alerts" className="meta" style={{ fontSize: 13 }}>
          ← Back to alerts
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)", gap: 24 }}>
        <div className="card fade-in">
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Configuration</h2>
          <AlertRuleForm
            rule={{
              id: rule.id,
              name: rule.name,
              description: rule.description,
              ruleType: rule.ruleType,
              thresholdCount: rule.thresholdCount,
              thresholdWindow: rule.thresholdWindow,
              environment: rule.environment,
              enabled: rule.enabled,
              cooldownMinutes: rule.cooldownMinutes,
              channelIds: rule.channelIds,
              query: rule.query,
            }}
            channels={channels.map((c) => ({
              id: c.id,
              name: c.name,
              channelType: c.channelType,
              enabled: c.enabled,
            }))}
          />
        </div>

        <div>
          <div className="card fade-in" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Stats</h3>
            <p className="meta" style={{ fontSize: 13, marginBottom: 4 }}>
              Last fired
            </p>
            <p style={{ fontSize: 16, marginBottom: 12 }}>
              {rule.lastTriggeredAt
                ? new Date(rule.lastTriggeredAt).toLocaleString()
                : "Never"}
            </p>
            <p className="meta" style={{ fontSize: 13, marginBottom: 4 }}>
              Deliveries (recent)
            </p>
            <p style={{ fontSize: 16 }}>{deliveries.length}</p>
          </div>

          <div className="card fade-in">
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Recent deliveries</h3>
            {deliveries.length === 0 ? (
              <p className="meta" style={{ fontSize: 13 }}>
                No deliveries yet.
              </p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {deliveries.slice(0, 10).map((d) => (
                  <li
                    key={d.id}
                    style={{
                      padding: "8px 0",
                      borderBottom: "1px solid var(--dash-border)",
                      fontSize: 13,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        className={`badge ${
                          d.status === "delivered"
                            ? "badge-resolved"
                            : d.status === "failed"
                              ? "badge-error"
                              : "badge-info"
                        }`}
                      >
                        {d.status}
                      </span>
                      <span className="meta">{d.channelName}</span>
                    </div>
                    <p
                      className="meta"
                      style={{ fontSize: 12, margin: 0, marginTop: 2 }}
                    >
                      {new Date(d.createdAt).toLocaleString()}
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
