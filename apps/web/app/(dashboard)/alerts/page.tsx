import Link from "next/link";
import { requireOrganizationId } from "@/lib/clerk-auth";
import { listAlertRules, listAlertChannels, listAlertDeliveries } from "@/lib/queries-alerts";
import { PageHeaderBar } from "@/components/page-header-bar";
import {
  AlertRuleList,
  AlertChannelList,
  AlertDeliveryList,
  type AlertRuleRow,
  type AlertChannelRow,
  type AlertDeliveryRow,
} from "@/components/alert-lists";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

function toRuleRow(rule: Awaited<ReturnType<typeof listAlertRules>>[number]): AlertRuleRow {
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    ruleType: rule.ruleType,
    thresholdCount: rule.thresholdCount,
    thresholdWindow: rule.thresholdWindow,
    environment: rule.environment,
    enabled: rule.enabled,
    cooldownMinutes: rule.cooldownMinutes,
    lastTriggeredAt: rule.lastTriggeredAt,
    channelIds: rule.channelIds,
    projectId: rule.projectId,
  };
}

function toChannelRow(
  channel: Awaited<ReturnType<typeof listAlertChannels>>[number]
): AlertChannelRow {
  return {
    id: channel.id,
    name: channel.name,
    channelType: channel.channelType,
    enabled: channel.enabled,
    ruleCount: channel.ruleCount,
    createdAt: channel.createdAt,
  };
}

function toDeliveryRow(
  d: Awaited<ReturnType<typeof listAlertDeliveries>>[number]
): AlertDeliveryRow {
  return {
    id: d.id,
    ruleName: d.ruleName,
    channelName: d.channelName,
    status: d.status,
    responseCode: d.responseCode,
    errorMessage: d.errorMessage,
    attempt: d.attempt,
    sentAt: d.sentAt,
    createdAt: d.createdAt,
  };
}

export default async function AlertsPage({ searchParams }: PageProps) {
  const organizationId = await requireOrganizationId();
  const { tab } = await searchParams;
  const activeTab = tab === "channels" ? "channels" : tab === "deliveries" ? "deliveries" : "rules";

  const [rules, channels, deliveries] = await Promise.all([
    listAlertRules(organizationId),
    listAlertChannels(organizationId),
    listAlertDeliveries({ organizationId, limit: 50 }),
  ]);

  return (
    <main className="dash-page">
      <PageHeaderBar title="Alerts" />

      <div
        className="fade-in"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 24,
          marginBottom: 24,
          borderBottom: "1px solid var(--dash-border)",
          paddingBottom: 0,
        }}
      >
        <TabLink href="/alerts" label={`Rules (${rules.length})`} active={activeTab === "rules"} />
        <TabLink
          href="/alerts?tab=channels"
          label={`Channels (${channels.length})`}
          active={activeTab === "channels"}
        />
        <TabLink
          href="/alerts?tab=deliveries"
          label={`Deliveries (${deliveries.length})`}
          active={activeTab === "deliveries"}
        />
        <div style={{ flex: 1 }} />
        {activeTab === "rules" ? (
          <Link
            href="/alerts/rules/new"
            className="btn"
            style={{ marginBottom: 12, display: "inline-flex" }}
          >
            + New rule
          </Link>
        ) : null}
        {activeTab === "channels" ? (
          <Link
            href="/alerts/channels/new"
            className="btn"
            style={{ marginBottom: 12, display: "inline-flex" }}
          >
            + New channel
          </Link>
        ) : null}
      </div>

      <div className="fade-in">
        {activeTab === "rules" ? (
          <AlertRuleList rules={rules.map(toRuleRow)} />
        ) : activeTab === "channels" ? (
          <AlertChannelList channels={channels.map(toChannelRow)} />
        ) : (
          <div className="card fade-in">
            <h2 style={{ fontSize: 20, marginBottom: 16 }}>Recent deliveries</h2>
            <AlertDeliveryList deliveries={deliveries.map(toDeliveryRow)} />
          </div>
        )}
      </div>
    </main>
  );
}

interface TabLinkProps {
  href: string;
  label: string;
  active: boolean;
}

function TabLink({ href, label, active }: TabLinkProps) {
  return (
    <Link
      href={href}
      style={{
        padding: "12px 16px",
        fontSize: 14,
        fontWeight: active ? 500 : 400,
        color: active ? "var(--text)" : "var(--text-muted)",
        borderBottom: active ? "2px solid var(--cta)" : "2px solid transparent",
        textDecoration: "none",
        marginBottom: -1,
      }}
    >
      {label}
    </Link>
  );
}
