"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOC_PAGES } from "@/lib/docs-config";

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="docs-sidebar">
      <p className="docs-sidebar-label">Documentation</p>
      <nav className="docs-sidebar-nav">
        {DOC_PAGES.map((page, index) => {
          const href = `/docs/${page.slug}`;
          const active = pathname === href;
          return (
            <Link
              key={page.slug}
              href={href}
              className={`docs-sidebar-link ${active ? "active" : ""}`}
              style={{ "--index": index } as React.CSSProperties}
            >
              <span className="docs-sidebar-link-title">{page.title}</span>
              <span className="docs-sidebar-link-desc">{page.description}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
