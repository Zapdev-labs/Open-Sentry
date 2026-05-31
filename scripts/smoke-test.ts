const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";
const INGEST_URL = process.env.INGEST_URL ?? "http://localhost:3001";

async function checkHealth(): Promise<void> {
  const ingestHealth = await fetch(`${INGEST_URL}/health`);
  if (!ingestHealth.ok) throw new Error("Ingest health check failed");

  const webHealth = await fetch(`${WEB_URL}/api/health`);
  if (!webHealth.ok) throw new Error("Web health check failed");

  console.log("Health checks passed");
}

async function checkAuth(): Promise<void> {
  const res = await fetch(`${WEB_URL}/api/auth/ok`);
  if (!res.ok) throw new Error("Auth health check failed");

  const data = (await res.json()) as { status?: string };
  if (data.status !== "ok") throw new Error("Auth not configured");

  console.log("Auth API passed");
}

async function main() {
  await checkHealth();
  await checkAuth();
  console.log("Smoke test passed");
}

main().catch((error: unknown) => {
  console.error("Smoke test failed:", error);
  process.exit(1);
});
