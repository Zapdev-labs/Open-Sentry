interface TimelinePoint {
  date: string;
  count: number;
}

interface IssueTimelineChartProps {
  points: TimelinePoint[];
  total: number;
}

export function IssueTimelineChart({ points, total }: IssueTimelineChartProps) {
  const max = Math.max(...points.map((p) => p.count), 1);

  return (
    <div className="card timeline-chart">
      <div className="timeline-chart-header">
        <h4 className="context-heading">Event frequency</h4>
        <span className="meta">{total} events in last 7 days</span>
      </div>
      <div className="timeline-bars">
        {points.map((point) => (
          <div key={point.date} className="timeline-bar-col">
            <div
              className="timeline-bar"
              style={{ height: `${Math.max((point.count / max) * 100, point.count > 0 ? 8 : 2)}%` }}
              title={`${point.date}: ${point.count}`}
            />
            <span className="timeline-label">
              {new Date(point.date).toLocaleDateString(undefined, {
                weekday: "short",
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
