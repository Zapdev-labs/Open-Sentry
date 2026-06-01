export default function DashboardLoading() {
  return (
    <main className="dash-page">
      <div className="fade-in" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          aria-hidden
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            border: "2px solid var(--dash-border)",
            borderTopColor: "var(--cta)",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p className="meta" style={{ margin: 0 }}>Loading…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
