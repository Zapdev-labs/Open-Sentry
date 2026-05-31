import Link from "next/link";
import { notFound } from "next/navigation";
import { Bug, ChartLine, Gear, SquaresFour } from "@phosphor-icons/react/dist/ssr";
import { getProject } from "@/lib/queries";
import { requireOrganizationId } from "@/lib/session-org";

interface ProjectNavProps {
  projectId: string;
  active: "overview" | "issues" | "performance" | "settings";
}

export async function ProjectNav({ projectId, active }: ProjectNavProps) {
  const organizationId = await requireOrganizationId();
  const project = await getProject(projectId, organizationId);
  if (!project) notFound();

  const links = [
    {
      href: `/projects/${projectId}/overview`,
      label: "Overview",
      icon: SquaresFour,
      key: "overview" as const,
    },
    { href: `/projects/${projectId}/issues`, label: "Issues", icon: Bug, key: "issues" as const },
    {
      href: `/projects/${projectId}/performance`,
      label: "Performance",
      icon: ChartLine,
      key: "performance" as const,
    },
    {
      href: `/projects/${projectId}/settings`,
      label: "Settings",
      icon: Gear,
      key: "settings" as const,
    },
  ];

  return (
    <header className="container page-header fade-in">
      <Link href="/" className="meta" style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
        All projects
      </Link>
      <h1 style={{ fontSize: 36 }}>{project.name}</h1>
      <nav style={{ display: "flex", gap: 24, marginTop: 24, flexWrap: "wrap" }}>
        {links.map(({ href, label, icon: Icon, key }) => (
          <Link
            key={key}
            href={href}
            className={`nav-link ${active === key ? "active" : ""}`}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Icon size={18} weight="bold" />
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
