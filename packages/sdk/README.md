# @zapdev-labs/sentry-clone

Error, performance, and AI generation monitoring SDK for [Open Sentry](https://github.com/Zapdev-labs/sentry-clone).

Lightweight (~zero runtime dependencies), works in both **browser** and **Node.js** environments. Captures exceptions, transactions/spans, breadcrumbs, and LLM token usage, then batches them to your Open Sentry ingest endpoint.

## Installation

```bash
npm install @zapdev-labs/sentry-clone
# or
bun add @zapdev-labs/sentry-clone
```

Requires Node.js >= 18.

## Quick start

```ts
import { init, captureException } from "@zapdev-labs/sentry-clone";

init({
  dsn: "https://<publicKey>@your-open-sentry.example.com/ingest",
  environment: "production",
  release: "my-app@1.0.0",
});

try {
  doSomethingRisky();
} catch (err) {
  captureException(err);
}
```

Calling `init()` installs global handlers for `uncaughtException` / `unhandledRejection` (Node) and `error` / `unhandledrejection` (browser), so unhandled errors are captured automatically. On Node it also flushes pending events on `beforeExit`.

## Configuration

`init(options)` accepts:

| Option              | Type      | Default        | Description                                                          |
| ------------------- | --------- | -------------- | -------------------------------------------------------------------- |
| `dsn`               | `string`  | **(required)** | Your project DSN. Throws if missing.                                 |
| `environment`       | `string`  | `"production"` | Environment tag attached to every event.                            |
| `release`           | `string`  | `"unknown"`    | Release identifier attached to every event.                         |
| `sampleRate`        | `number`  | `1.0`          | Fraction of errors/messages to send (0–1).                          |
| `tracesSampleRate`  | `number`  | `0.1`          | Fraction of transactions to send (0–1).                             |
| `maxBreadcrumbs`    | `number`  | `50`           | Maximum breadcrumbs retained per event.                             |
| `enableBreadcrumbs` | `boolean` | `true`         | Auto-install breadcrumb integrations (console, fetch, navigation, clicks). |

### DSN format

```
<protocol>://<publicKey>@<host>/<path>
```

The username portion is the public key; the rest is the ingest URL. A DSN without a public key throws `Invalid DSN: missing public key`.

## Capturing errors and messages

```ts
import { captureException, captureMessage } from "@zapdev-labs/sentry-clone";

captureException(new Error("Payment failed"));

// Non-Error values are coerced to Error
captureException("something went wrong");

captureMessage("User hit rate limit", "warning"); // "info" | "warning" | "error"
```

Stack traces are parsed into structured frames, with frames from `node_modules`, bundlers, and runtime internals marked as not in-app.

## Transactions and spans

```ts
import { startTransaction } from "@zapdev-labs/sentry-clone";

const tx = startTransaction("checkout");

const dbSpan = tx.startChild("db.query", "SELECT users");
await db.query("SELECT * FROM users");
dbSpan.finish();

const apiSpan = tx.startChild("http.client", "POST /api/charge");
await fetch("/api/charge", { method: "POST" });
apiSpan.finish();

tx.finish("ok"); // "ok" | "error" | "cancelled"
```

Transactions respect `tracesSampleRate` — only a sampled fraction are sent.

## Scope: users and tags

```ts
import { setUser, setTag, setTags, clearScope } from "@zapdev-labs/sentry-clone";

setUser({ id: "42", email: "user@example.com", username: "jane" });
setTag("feature", "checkout");
setTags({ region: "us-east", plan: "pro" });

// Later, e.g. on logout
clearScope();
```

User and tag context is attached to subsequent errors and AI generation events.

## Breadcrumbs

With `enableBreadcrumbs` (default on), the SDK automatically records:

- **console** calls (`log`, `info`, `warn`, `error`, `debug`)
- **fetch** requests and responses (browser)
- **navigation** changes via `popstate` / `pushState` (browser)
- **UI clicks** on buttons, links, and submit inputs (browser)
- **runtime** info on Node

You can also add breadcrumbs manually:

```ts
import { addBreadcrumb } from "@zapdev-labs/sentry-clone";

addBreadcrumb({
  category: "auth",
  message: "User logged in",
  level: "info",
  type: "default",
});
```

Breadcrumbs are bounded by `maxBreadcrumbs` (oldest dropped first) and included with each captured error.

## AI generation tracking

Track LLM token usage, cost, and latency.

```ts
import { captureGeneration } from "@zapdev-labs/sentry-clone";

captureGeneration({
  provider: "openai",
  model: "gpt-4o",
  inputTokens: 1200,
  outputTokens: 350,
  totalCostUsd: 0.012,
  latencyMs: 1840,
  status: "ok",
});
```

### OpenRouter helper

If you use OpenRouter, pass its `usage` object directly:

```ts
import { captureOpenRouterGeneration } from "@zapdev-labs/sentry-clone";

const completion = await openrouter.chat.completions.create({ /* ... */ });

captureOpenRouterGeneration(completion.usage, "anthropic/claude-3.5-sonnet", {
  latencyMs: 1500,
});
```

This maps prompt/completion tokens, total cost, and detail fields (cached tokens, reasoning tokens, upstream cost) into the generation event automatically.

## Flushing

Events are batched and flushed every 2 seconds, when the queue reaches 20 items, on page unload (browser, via `sendBeacon`), and on `beforeExit` (Node). For short-lived scripts, flush explicitly before exit:

```ts
import { flush } from "@zapdev-labs/sentry-clone";

await flush();
```

## API reference

| Export | Description |
| --- | --- |
| `init(options)` | Initialize the SDK and install global handlers. |
| `captureException(error)` | Capture an error or arbitrary thrown value. |
| `captureMessage(message, level?)` | Capture a string message. |
| `startTransaction(name)` | Begin a performance transaction; returns `{ finish, startChild }`. |
| `captureGeneration(options)` | Record an AI generation event. |
| `captureOpenRouterGeneration(usage, model, extras?)` | Record a generation from an OpenRouter usage object. |
| `addBreadcrumb(crumb)` | Append a breadcrumb to the current buffer. |
| `setUser(user \| null)` | Set or clear the current user context. |
| `setTag(key, value)` / `setTags(map)` | Set scope tags. |
| `clearScope()` | Clear user and tags. |
| `flush()` | Flush queued events; resolves when sent. |
| `parseDsn(dsn)` | Parse a DSN into `{ publicKey, ingestUrl }`. |

Exported types include `SdkOptions`, `Breadcrumb`, `UserContext`, `CaptureGenerationOptions`, `OpenRouterUsage`, `IngestItem`, `ErrorIngestItem`, `TransactionIngestItem`, `AiGenerationIngestItem`, `StackFrame`, and `SpanPayload`.

## License

MIT
