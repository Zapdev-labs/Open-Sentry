import {
  init,
  captureException,
  captureMessage,
  startTransaction,
  addBreadcrumb,
  setUser,
  setTag,
  flush,
} from "@zapdev-labs/sentry-clone";

const dsn = process.env.DSN;
if (!dsn) {
  console.error("Set DSN env var to your project DSN");
  process.exit(1);
}

init({
  dsn,
  environment: "demo",
  release: "demo@1.0.0",
  sampleRate: 1.0,
  tracesSampleRate: 1.0,
  enableBreadcrumbs: true,
});

setUser({ id: "demo-user-42", email: "dev@example.com", username: "demo-dev" });
setTag("feature", "checkout");
setTag("version", "1.0.0");

addBreadcrumb({ category: "demo", message: "Demo app started", level: "info", type: "default" });
console.info("Checkout flow initialized");

console.log("Sending demo error...");
captureException(new Error("Demo error from demo-app"));

console.log("Sending demo message...");
captureMessage("Demo message captured", "warning");

console.log("Sending demo transaction...");
const tx = startTransaction("demo-checkout");
const dbSpan = tx.startChild("db.query", "SELECT users");
await Bun.sleep(50);
dbSpan.finish();
const apiSpan = tx.startChild("http.client", "POST /api/checkout");
await Bun.sleep(100);
apiSpan.finish();
tx.finish();

await Bun.sleep(3000);
await flush();
console.log("Demo complete. Check the dashboard for results.");
