import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  ArrowRight,
  Bug,
  ChartLineUp,
  Brain,
  PlugsConnected,
  BellRinging,
  Pulse,
  ShieldCheck,
  Lightning,
} from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

const features = [
  {
    icon: Bug,
    title: "Error tracking",
    body: "Capture exceptions with full stack traces, breadcrumbs, and request context. Events are grouped into issues automatically so noise collapses into signal.",
  },
  {
    icon: ChartLineUp,
    title: "Performance tracing",
    body: "Distributed transactions and spans reveal slow database calls and N+1 queries. Find the p95 regression before your customers do.",
  },
  {
    icon: Pulse,
    title: "Uptime monitoring",
    body: "Probe your endpoints on a schedule from the worker fleet. Consecutive failures open an incident and page the right people.",
  },
  {
    icon: Brain,
    title: "AI cost analytics",
    body: "Track LLM generations, token usage, and prompt-cache hit rates end to end. Know exactly what each model call costs.",
  },
  {
    icon: PlugsConnected,
    title: "Native integrations",
    body: "Link issues straight to Linear and keep external references in sync. Triage in the dashboard, ship from your tracker.",
  },
  {
    icon: BellRinging,
    title: "Alerting",
    body: "Threshold and spike rules route to the channels your team already lives in, so the first you hear of an outage isn't a tweet.",
  },
];

export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link href="/" className="landing-brand">
            <span className="landing-brand-mark">
              <Bug size={18} weight="bold" />
            </span>
            Open Sentry
          </Link>
          <nav className="landing-nav-links">
            <a href="#features" className="nav-link">
              Features
            </a>
            <a href="#install" className="nav-link">
              Install
            </a>
            <Link href="/docs/overview" className="nav-link">
              Docs
            </Link>
          </nav>
          <div className="landing-nav-actions">
            <ThemeToggle />
            <Link href="/login" className="nav-link">
              Sign in
            </Link>
            <Link href="/login?from=/dashboard" className="btn">
              Get started
              <ArrowRight size={16} weight="bold" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="container landing-hero-inner">
            <span className="landing-eyebrow">
              <Lightning size={13} weight="fill" /> Open-source observability
            </span>
            <h1 className="landing-title">
              Know the moment your code breaks &mdash; and why.
            </h1>
            <p className="landing-sub">
              Errors, performance, uptime, and AI spend in one self-hostable platform.
              Drop in the SDK, ship, and watch every regression surface in real time.
            </p>
            <div className="landing-cta-row">
              <Link href="/login?from=/dashboard" className="btn">
                Start monitoring free
                <ArrowRight size={16} weight="bold" />
              </Link>
              <Link href="/docs/overview" className="btn btn-secondary">
                Read the docs
              </Link>
            </div>
            <p className="landing-cta-note">No credit card. Self-host or run it on Railway in minutes.</p>
          </div>

          <div className="container landing-mock-wrap">
            <div className="window-chrome landing-mock fade-in">
              <div className="window-chrome-bar">
                <span className="window-dot" />
                <span className="window-dot" />
                <span className="window-dot" />
                <span className="landing-mock-url">app.opensentry.dev / issues</span>
              </div>
              <div className="landing-mock-body">
                <div className="landing-mock-stats">
                  <div className="landing-mock-stat">
                    <span className="landing-mock-stat-value">1,284</span>
                    <span className="landing-mock-stat-label">Events / hr</span>
                  </div>
                  <div className="landing-mock-stat">
                    <span className="landing-mock-stat-value">3</span>
                    <span className="landing-mock-stat-label">Open issues</span>
                  </div>
                  <div className="landing-mock-stat">
                    <span className="landing-mock-stat-value">99.98%</span>
                    <span className="landing-mock-stat-label">Uptime 24h</span>
                  </div>
                  <div className="landing-mock-stat">
                    <span className="landing-mock-stat-value">142ms</span>
                    <span className="landing-mock-stat-label">p95 latency</span>
                  </div>
                </div>
                <div className="landing-mock-rows">
                  {[
                    { level: "error", title: "TypeError: cannot read 'id' of undefined", meta: "checkout.ts · 412 events" },
                    { level: "warning", title: "Slow query: SELECT * FROM events", meta: "db.ts · 1.8s p95" },
                    { level: "info", title: "Deploy v2.4.0 finished", meta: "release · 2m ago" },
                  ].map((row) => (
                    <div key={row.title} className="landing-mock-row">
                      <span className={`issue-level-dot issue-level-${row.level}`} />
                      <span className="landing-mock-row-title">{row.title}</span>
                      <span className="landing-mock-row-meta">{row.meta}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="landing-section">
          <div className="container">
            <h2 className="landing-section-title">Everything you need to keep production honest</h2>
            <p className="landing-section-sub">
              One platform for the four signals that actually wake engineers up at night.
            </p>
            <div className="landing-feature-grid">
              {features.map(({ icon: Icon, title, body }, i) => (
                <article
                  key={title}
                  className="card landing-feature stagger-item"
                  style={{ "--index": i } as React.CSSProperties}
                >
                  <span className="landing-feature-icon">
                    <Icon size={22} weight="bold" />
                  </span>
                  <h3 className="landing-feature-title">{title}</h3>
                  <p className="landing-feature-body">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="install" className="landing-section landing-section-muted">
          <div className="container landing-install">
            <div className="landing-install-copy">
              <h2 className="landing-section-title">Instrumented in three lines</h2>
              <p className="landing-section-sub">
                Install the SDK, point it at your DSN, and start capturing. The ingest pipeline
                returns in milliseconds and batches writes behind a queue, so monitoring never
                slows your app down.
              </p>
              <ul className="landing-check-list">
                <li>
                  <ShieldCheck size={18} weight="bold" /> Non-blocking 202 ingest
                </li>
                <li>
                  <ShieldCheck size={18} weight="bold" /> Org-scoped projects &amp; DSNs
                </li>
                <li>
                  <ShieldCheck size={18} weight="bold" /> Works with any JavaScript runtime
                </li>
              </ul>
            </div>
            <div className="window-chrome landing-code-window">
              <div className="window-chrome-bar">
                <span className="window-dot" />
                <span className="window-dot" />
                <span className="window-dot" />
                <span className="landing-mock-url">app.ts</span>
              </div>
              <pre className="landing-code">
                <code>{`import { init, captureException } from "@sentry-clone/sdk";

init({ dsn: process.env.SENTRY_DSN });

try {
  await checkout(order);
} catch (err) {
  captureException(err);
}`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section className="landing-section landing-final">
          <div className="container landing-final-inner">
            <h2 className="landing-final-title">Ship with the lights on.</h2>
            <p className="landing-section-sub">
              Spin up your workspace and connect your first project in under five minutes.
            </p>
            <Link href="/login?from=/dashboard" className="btn">
              Get started free
              <ArrowRight size={16} weight="bold" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="container landing-footer-inner">
          <Link href="/" className="landing-brand">
            <span className="landing-brand-mark">
              <Bug size={16} weight="bold" />
            </span>
            Open Sentry
          </Link>
          <div className="landing-footer-links">
            <Link href="/docs/overview" className="nav-link">
              Documentation
            </Link>
            <Link href="/login" className="nav-link">
              Sign in
            </Link>
            <a href="https://github.com/Zapdev-labs/sentry-clone" className="nav-link">
              GitHub
            </a>
          </div>
          <span className="landing-footer-meta">Open-source error &amp; performance monitoring</span>
        </div>
      </footer>
    </div>
  );
}
