import { notFound } from "next/navigation";
import { getProject, getTransactions, getTransactionStats, getTransactionSpans } from "@/lib/queries";
import { requireOrganizationId } from "@/lib/session-org";
import { ProjectNav } from "@/components/project-nav";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PerformancePage({ params }: PageProps) {
  const { id } = await params;
  const organizationId = await requireOrganizationId();
  const project = await getProject(id, organizationId);
  if (!project) notFound();

  const [stats, txList] = await Promise.all([getTransactionStats(id), getTransactions(id)]);

  const latestTx = txList[0];
  const spanList = latestTx ? await getTransactionSpans(latestTx.id) : [];

  return (
    <main>
      <ProjectNav projectId={id} active="performance" />

      <section className="container" style={{ paddingBottom: 64 }}>
        <div className="bento-grid fade-in" style={{ marginBottom: 48 }}>
          <div className="card">
            <div className="stat-value">{stats.count}</div>
            <div className="stat-label">Transactions</div>
          </div>
          <div className="card">
            <div className="stat-value">{stats.p50}ms</div>
            <div className="stat-label">p50 duration</div>
          </div>
          <div className="card">
            <div className="stat-value">{stats.p95}ms</div>
            <div className="stat-label">p95 duration</div>
          </div>
        </div>

        {txList.length === 0 ? (
          <div className="card fade-in">
            <p className="meta">No transactions yet. Use startTransaction() in the SDK to record performance data.</p>
          </div>
        ) : (
          <>
            <table className="table-editorial fade-in" style={{ marginBottom: 48 }}>
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Environment</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {txList.map((tx, i) => (
                  <tr key={tx.id} className="stagger-item" style={{ "--index": i } as React.CSSProperties}>
                    <td style={{ fontWeight: 500 }}>{tx.name}</td>
                    <td>
                      <span className="code-block">{tx.durationMs}ms</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${tx.status === "ok" ? "badge-resolved" : "badge-open"}`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="meta">{tx.environment ?? "—"}</td>
                    <td className="meta">{tx.timestamp.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {latestTx && spanList.length > 0 && (
              <div className="card fade-in">
                <h3 style={{ fontSize: 18, marginBottom: 16 }}>
                  Span breakdown — {latestTx.name}
                </h3>
                <ul className="span-tree">
                  {spanList.map((span) => (
                    <li key={span.id} className="span-tree-item">
                      <span className="code-block">{span.op}</span>
                      {span.description && ` — ${span.description}`}
                      <span className="meta" style={{ marginLeft: 8 }}>
                        {span.durationMs}ms
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
