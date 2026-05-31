const INGEST_URL = process.env.INGEST_URL ?? "http://localhost:3001/v1/ingest";
const PUBLIC_KEY = process.env.PUBLIC_KEY ?? "demo-key";
const CONCURRENT = Number(process.env.CONCURRENT ?? 100);
const REQUESTS = Number(process.env.REQUESTS ?? 100);
const WARMUP = Number(process.env.WARMUP ?? 20);

interface TimingResult {
  status: number;
  durationMs: number;
}

const payloadTemplate = () => ({
  type: "error" as const,
  exception: {
    type: "LoadTestError",
    value: `Load test at ${Date.now()}`,
    stacktrace: {
      frames: [{ filename: "load-test.ts", function: "sendRequest", inApp: true }],
    },
  },
  environment: "load-test",
});

async function sendRequest(): Promise<TimingResult> {
  const start = performance.now();
  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Open-Sentry-Key": PUBLIC_KEY,
      Connection: "keep-alive",
    },
    body: JSON.stringify(payloadTemplate()),
    keepalive: true,
  });
  return { status: res.status, durationMs: performance.now() - start };
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

async function main(): Promise<void> {
  console.log(`Load test: ${REQUESTS} requests, ${CONCURRENT} concurrent`);
  console.log(`Target: ${INGEST_URL}`);

  console.log(`Warming up (${WARMUP} requests)...`);
  await fetch(`${INGEST_URL.replace(/\/v1\/ingest$/, "")}/health`).catch(() => undefined);
  await Promise.all(Array.from({ length: WARMUP }, () => sendRequest()));

  const perWorker = Math.ceil(REQUESTS / CONCURRENT);
  const workers = Array.from({ length: CONCURRENT }, async () => {
    const local: TimingResult[] = [];
    for (let i = 0; i < perWorker; i++) {
      local.push(await sendRequest());
    }
    return local;
  });

  const batches = await Promise.all(workers);
  const results = batches.flat().slice(0, REQUESTS);

  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const success = results.filter((r) => r.status === 202).length;
  const p50 = percentile(durations, 50);
  const p95 = percentile(durations, 95);
  const p99 = percentile(durations, 99);
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;

  console.log("\nResults:");
  console.log(`  Success (202): ${success}/${results.length}`);
  console.log(`  p50: ${p50.toFixed(1)}ms`);
  console.log(`  p95: ${p95.toFixed(1)}ms`);
  console.log(`  p99: ${p99.toFixed(1)}ms`);
  console.log(`  avg: ${avg.toFixed(1)}ms`);

  if (p95 >= 100) {
    console.log("\nFAIL: p95 >= 100ms");
    process.exit(1);
  }

  console.log("\nPASS: p95 < 100ms");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
