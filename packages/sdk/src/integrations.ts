type AddBreadcrumbFn = (crumb: {
  category?: string;
  message?: string;
  level?: "debug" | "info" | "warning" | "error";
  type?: string;
  data?: Record<string, unknown>;
}) => void;

export function installBreadcrumbIntegrations(addBreadcrumb: AddBreadcrumbFn): void {
  if (typeof window === "undefined") {
    installNodeIntegrations(addBreadcrumb);
    return;
  }

  installConsoleIntegration(addBreadcrumb);
  installFetchIntegration(addBreadcrumb);
  installNavigationIntegration(addBreadcrumb);
  installClickIntegration(addBreadcrumb);
}

function installConsoleIntegration(addBreadcrumb: AddBreadcrumbFn): void {
  const levels = ["log", "info", "warn", "error", "debug"] as const;
  for (const level of levels) {
    const original = console[level] as (...args: unknown[]) => void;
    console[level] = (...args: unknown[]) => {
      addBreadcrumb({
        type: "console",
        category: "console",
        level: level === "warn" ? "warning" : level === "log" ? "info" : level,
        message: args.map(formatConsoleArg).join(" "),
        data: { arguments: args.slice(0, 5).map(formatConsoleArg) },
      });
      original.apply(console, args);
    };
  }
}

function formatConsoleArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return arg.message;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function installFetchIntegration(addBreadcrumb: AddBreadcrumbFn): void {
  const originalFetch = window.fetch.bind(window);
  const wrappedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const start = performance.now();

    addBreadcrumb({
      type: "http",
      category: "fetch",
      level: "info",
      message: `${method} ${url}`,
      data: { url, method, type: "fetch" },
    });

    try {
      const response = await originalFetch(input, init);
      addBreadcrumb({
        type: "http",
        category: "fetch",
        level: response.ok ? "info" : "warning",
        message: `${method} ${url} → ${response.status}`,
        data: {
          url,
          method,
          status_code: response.status,
          duration_ms: Math.round(performance.now() - start),
        },
      });
      return response;
    } catch (err) {
      addBreadcrumb({
        type: "http",
        category: "fetch",
        level: "error",
        message: `${method} ${url} failed`,
        data: {
          url,
          method,
          error: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  };
  window.fetch = Object.assign(wrappedFetch, originalFetch);
}

function installNavigationIntegration(addBreadcrumb: AddBreadcrumbFn): void {
  addBreadcrumb({
    type: "navigation",
    category: "navigation",
    level: "info",
    message: `Initial: ${window.location.pathname}`,
    data: { from: "", to: window.location.href },
  });

  window.addEventListener("popstate", () => {
    addBreadcrumb({
      type: "navigation",
      category: "navigation",
      level: "info",
      message: `Navigate: ${window.location.pathname}`,
      data: { to: window.location.href },
    });
  });

  const originalPushState = history.pushState.bind(history);
  history.pushState = (...args) => {
    originalPushState(...args);
    addBreadcrumb({
      type: "navigation",
      category: "navigation",
      level: "info",
      message: `Navigate: ${window.location.pathname}`,
      data: { to: window.location.href },
    });
  };
}

function installClickIntegration(addBreadcrumb: AddBreadcrumbFn): void {
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const el = target.closest("button, a, [role='button'], input[type='submit']");
      if (!el) return;

      const tag = el.tagName.toLowerCase();
      const text = (el.textContent ?? "").trim().slice(0, 80);
      const selector = buildSelector(el);

      addBreadcrumb({
        type: "ui",
        category: "ui.click",
        level: "info",
        message: text ? `Click: ${text}` : `Click on ${tag}`,
        data: { tag, selector, text: text || undefined },
      });
    },
    true
  );
}

function buildSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  const testId = el.getAttribute("data-testid");
  if (testId) return `[data-testid="${testId}"]`;
  const classes = Array.from(el.classList).slice(0, 2).join(".");
  return classes ? `${el.tagName.toLowerCase()}.${classes}` : el.tagName.toLowerCase();
}

function installNodeIntegrations(addBreadcrumb: AddBreadcrumbFn): void {
  installConsoleIntegration(addBreadcrumb);

  if (typeof process !== "undefined") {
    addBreadcrumb({
      type: "default",
      category: "runtime",
      level: "info",
      message: `Node ${process.version}`,
      data: { platform: process.platform, node: process.version },
    });
  }
}
