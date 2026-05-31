interface CostPoint {
  date: string;
  costUsd: number;
  count: number;
}

interface AiCostTimelineChartProps {
  points: CostPoint[];
  totalCostUsd: number;
}

function formatUsd(value: number): string {
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(6)}`;
}

export function AiCostTimelineChart({ points, totalCostUsd }: AiCostTimelineChartProps) {
  const max = Math.max(...points.map((p) => p.costUsd), 0.000001);

  return (
    <div className="card timeline-chart">
      <div className="timeline-chart-header">
        <h4 className="context-heading">Daily spend</h4>
        <span className="meta">{formatUsd(totalCostUsd)} over last 7 days</span>
      </div>
      <div className="timeline-bars">
        {points.map((point) => (
          <div key={point.date} className="timeline-bar-col">
            <div
              className="timeline-bar"
              style={{
                height: `${Math.max((point.costUsd / max) * 100, point.costUsd > 0 ? 8 : 2)}%`,
              }}
              title={`${point.date}: ${formatUsd(point.costUsd)} (${point.count} calls)`}
            />
            <span className="timeline-label">
              {new Date(point.date).toLocaleDateString(undefined, { weekday: "short" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
