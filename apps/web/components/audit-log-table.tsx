function formatDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

interface AuditRow {
  id: string;
  createdAt: Date;
  action: string;
  actorEmail: string | null;
  actorId: string | null;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  ipAddress: string | null;
  metadata: Record<string, unknown>;
}

interface AuditLogTableProps {
  rows: AuditRow[];
  total: number;
  shown: number;
}

export function AuditLogTable({ rows, total, shown }: AuditLogTableProps) {
  if (rows.length === 0) {
    return (
      <div
        className="meta"
        style={{
          padding: "32px 0",
          textAlign: "center",
          border: "1px dashed var(--dash-border)",
          borderRadius: 10,
        }}
      >
        No audit events match these filters.
      </div>
    );
  }

  return (
    <>
      <p className="meta" style={{ marginBottom: 8 }}>
        Showing {shown} of {total} events
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="table-editorial">
          <thead>
            <tr>
              <th style={{ minWidth: 160 }}>When</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Target</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="meta" style={{ whiteSpace: "nowrap" }}>
                  {formatDate(new Date(row.createdAt))}
                </td>
                <td>
                  <code style={{ fontSize: 12 }}>{row.action}</code>
                </td>
                <td className="meta">{row.actorEmail ?? row.actorId ?? "system"}</td>
                <td className="meta">
                  {row.targetLabel ?? row.targetId ?? "—"}
                  {row.targetType ? (
                    <span className="meta" style={{ marginLeft: 6, fontSize: 11 }}>
                      ({row.targetType})
                    </span>
                  ) : null}
                </td>
                <td className="meta" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                  {row.ipAddress ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
