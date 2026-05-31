import Link from "next/link";
import { BookOpen, Bug, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { ThemeToggle } from "@/components/theme-toggle";

export function DocsHeader() {
  return (
    <header className="docs-header">
      <div className="docs-header-inner">
        <div className="docs-header-left">
          <Link href="/docs/overview" className="docs-brand">
            <Bug size={22} weight="bold" />
            <span>Open Sentry</span>
          </Link>
          <span className="docs-header-divider" />
          <span className="docs-header-tag">
            <BookOpen size={16} weight="bold" />
            Docs
          </span>
        </div>
        <nav className="docs-header-nav">
          <ThemeToggle />
          <Link href="/docs/api-reference" className="docs-header-link">
            API
          </Link>
          <Link href="/login" className="docs-header-link">
            Sign in
          </Link>
          <Link href="/" className="btn btn-secondary docs-header-cta">
            Dashboard
            <ArrowSquareOut size={16} weight="bold" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
