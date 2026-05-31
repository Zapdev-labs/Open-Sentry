import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { resolveDocHref } from "@/lib/docs-config";

const components: Components = {
  h1: ({ children }) => <h1 className="docs-h1">{children}</h1>,
  h2: ({ children }) => <h2 className="docs-h2">{children}</h2>,
  h3: ({ children }) => <h3 className="docs-h3">{children}</h3>,
  p: ({ children }) => <p className="docs-p">{children}</p>,
  a: ({ href, children }) => {
    const resolved = resolveDocHref(href);
    if (resolved?.startsWith("/")) {
      return (
        <Link href={resolved} className="docs-a">
          {children}
        </Link>
      );
    }
    return (
      <a href={resolved} className="docs-a" target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  ul: ({ children }) => <ul className="docs-ul">{children}</ul>,
  ol: ({ children }) => <ol className="docs-ol">{children}</ol>,
  li: ({ children }) => <li className="docs-li">{children}</li>,
  hr: () => <hr className="docs-hr" />,
  blockquote: ({ children }) => <blockquote className="docs-blockquote">{children}</blockquote>,
  table: ({ children }) => (
    <div className="docs-table-wrap">
      <table className="docs-table">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => <th>{children}</th>,
  td: ({ children }) => <td>{children}</td>,
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return <code className={className}>{children}</code>;
    }
    return <code className="docs-inline-code">{children}</code>;
  },
  pre: ({ children }) => (
    <div className="docs-pre-wrap">
      <div className="window-chrome">
        <div className="window-chrome-bar">
          <span className="window-dot" />
          <span className="window-dot" />
          <span className="window-dot" />
        </div>
        <pre className="docs-pre">{children}</pre>
      </div>
    </div>
  ),
};

export function DocsMarkdown({ content }: { content: string }) {
  return (
    <article className="docs-prose fade-in">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </article>
  );
}
