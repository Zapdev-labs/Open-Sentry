import { notFound } from "next/navigation";
import {
  getProject,
  getAiGenerations,
  getAiGenerationStats,
  getAiGenerationStatsToday,
  getAiGenerationByModel,
  getAiCostTimeline,
} from "@/lib/queries";
import { requireOrganizationId } from "@/lib/clerk-auth";
import { PageHeaderBar } from "@/components/page-header-bar";
import { AiCostTimelineChart } from "@/components/ai-cost-timeline-chart";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatUsd(value: number): string {
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  if (value > 0) return `$${value.toFixed(6)}`;
  return "$0.00";
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toString();
}

export default async function AiAnalyticsPage({ params }: PageProps) {
  const { id } = await params;
  const organizationId = await requireOrganizationId();
  const project = await getProject(id, organizationId);
  if (!project) notFound();

  const [stats, today, byModel, timeline, generations] = await Promise.all([
    getAiGenerationStats(id),
    getAiGenerationStatsToday(id),
    getAiGenerationByModel(id),
    getAiCostTimeline(id),
    getAiGenerations(id),
  ]);

  const weekCost = timeline.reduce((sum, point) => sum + point.costUsd, 0);

  return (
    <main className="dash-page">
      <PageHeaderBar title="AI analytics" />

      <div className="bento-grid fade-in" style={{ marginTop: 24, marginBottom: 48 }}>
        <div className="card">
          <div className="stat-value">{formatUsd(stats.totalCostUsd)}</div>
          <div className="stat-label">Total spend</div>
        </div>
        <div className="card">
          <div className="stat-value">{formatUsd(today.totalCostUsd)}</div>
          <div className="stat-label">Spend today</div>
        </div>
        <div className="card">
          <div className="stat-value">{stats.count}</div>
          <div className="stat-label">Generations</div>
        </div>
        <div className="card">
          <div className="stat-value">{formatTokens(stats.totalInputTokens + stats.totalOutputTokens)}</div>
          <div className="stat-label">Total tokens</div>
        </div>
        <div className="card">
          <div className="stat-value">{stats.avgLatencyMs}ms</div>
          <div className="stat-label">Avg latency</div>
        </div>
        <div className="card">
          <div className="stat-value">{stats.errorRate}%</div>
          <div className="stat-label">Error rate</div>
        </div>
        <div className="card">
          <div className="stat-value">{stats.cacheHitRate}%</div>
          <div className="stat-label">Cache hit rate</div>
        </div>
        <div className="card">
          <div className="stat-value">{formatTokens(stats.totalCachedTokens)}</div>
          <div className="stat-label">
            Cached tokens
            <span className="meta" style={{ display: "block", fontSize: 11 }}>
              {formatTokens(stats.totalCacheWriteTokens)} written
            </span>
          </div>
        </div>
      </div>

      {stats.count === 0 ? (
        <div className="card fade-in">
          <p className="meta" style={{ marginBottom: 12 }}>
            No AI generations yet. Use captureGeneration() or captureOpenRouterGeneration() in the SDK
            to track model usage and cost.
          </p>
          <pre className="code-block" style={{ fontSize: 13, overflow: "auto" }}>
            {`import { captureOpenRouterGeneration } from "@zapdev-labs/sentry-clone";

const response = await openai.chat.completions.create({ ... });
captureOpenRouterGeneration(response.usage, response.model, {
  latencyMs: Date.now() - startedAt,
});`}
          </pre>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 48 }}>
            <AiCostTimelineChart points={timeline} totalCostUsd={weekCost} />
          </div>

          {byModel.length > 0 && (
            <table className="table-editorial fade-in" style={{ marginBottom: 48 }}>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Provider</th>
                  <th>Calls</th>
                  <th>Tokens</th>
                  <th>Cache hit</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {byModel.map((row, i) => (
                  <tr key={`${row.provider}:${row.model}`} className="stagger-item" style={{ "--index": i } as React.CSSProperties}>
                    <td style={{ fontWeight: 500 }}>{row.model}</td>
                    <td className="meta">{row.provider}</td>
                    <td>{row.count}</td>
                    <td>{formatTokens(row.totalTokens)}</td>
                    <td>
                      {row.cacheHitRate}%
                      <span className="meta" style={{ display: "block", fontSize: 11 }}>
                        {formatTokens(row.cachedTokens)} cached
                      </span>
                    </td>
                    <td>
                      <span className="code-block">{formatUsd(row.totalCostUsd)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <table className="table-editorial fade-in">
            <thead>
              <tr>
                <th>Model</th>
                <th>Tokens</th>
                <th>Cost</th>
                <th>Latency</th>
                <th>Status</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {generations.map((gen, i) => (
                <tr key={gen.id} className="stagger-item" style={{ "--index": i } as React.CSSProperties}>
                  <td style={{ fontWeight: 500 }}>
                    <span className="meta" style={{ display: "block", fontSize: 12 }}>
                      {gen.provider}
                    </span>
                    {gen.model}
                  </td>
                  <td>
                    <span className="code-block">
                      {formatTokens(gen.inputTokens)} in / {formatTokens(gen.outputTokens)} out
                    </span>
                  </td>
                  <td>
                    <span className="code-block">{formatUsd(parseUsd(gen.totalCostUsd))}</span>
                  </td>
                  <td className="meta">{gen.latencyMs != null ? `${gen.latencyMs}ms` : "—"}</td>
                  <td>
                    <span className={`badge ${gen.status === "ok" ? "badge-resolved" : "badge-open"}`}>
                      {gen.status}
                    </span>
                  </td>
                  <td className="meta">{gen.timestamp.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}

function parseUsd(value: string | null): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
