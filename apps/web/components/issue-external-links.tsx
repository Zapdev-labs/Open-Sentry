import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import type { IssueExternalLink } from "@sentry-clone/db";

interface IssueExternalLinksProps {
  links: IssueExternalLink[];
}

function providerLabel(provider: IssueExternalLink["provider"]): string {
  if (provider === "linear") return "Linear";
  return provider;
}

export function IssueExternalLinks({ links }: IssueExternalLinksProps) {
  if (links.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
      {links.map((link) => (
        <a
          key={link.id}
          href={link.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          {providerLabel(link.provider)}
          <ArrowSquareOut size={16} weight="bold" />
        </a>
      ))}
    </div>
  );
}
