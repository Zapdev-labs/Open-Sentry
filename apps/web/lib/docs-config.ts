export interface DocPage {
  slug: string;
  title: string;
  file: string;
  description: string;
}

export const DOC_PAGES: DocPage[] = [
  {
    slug: "overview",
    title: "Overview",
    file: "README.md",
    description: "What Open Sentry is and how the pieces fit together.",
  },
  {
    slug: "api-reference",
    title: "API reference",
    file: "api-reference.md",
    description: "Ingest HTTP API — auth, payloads, and production URLs.",
  },
  {
    slug: "architecture",
    title: "Architecture",
    file: "architecture.md",
    description: "Data flow, queues, grouping, and caching.",
  },
];

export function getDocPage(slug: string): DocPage | undefined {
  return DOC_PAGES.find((page) => page.slug === slug);
}

export function resolveDocHref(href: string | undefined): string | undefined {
  if (!href) return href;
  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("#")) {
    return href;
  }
  if (href.endsWith(".md")) {
    const base = href.replace(/^\.\//, "").replace(/\.md$/, "");
    if (base === "README") return "/docs/overview";
    return `/docs/${base}`;
  }
  return href;
}
