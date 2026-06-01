"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Archive,
  BellRinging,
  BookOpen,
  Brain,
  Bug,
  CaretDoubleLeft,
  ChartLine,
  ClipboardText,
  Compass,
  Gear,
  House,
  MagnifyingGlass,
  Pulse,
  Question,
  SquaresFour,
  Tag,
  Users,
} from "@phosphor-icons/react";
import { useSidebarProject } from "@/components/project-scope";
import { ThemeToggle } from "@/components/theme-toggle";

interface AppSidebarProps {
  userInitials: string;
}

const iconLinks = [
  { href: "/dashboard", label: "Overview", icon: House, match: (p: string) => p === "/dashboard" },
  {
    href: "#issues",
    label: "Issues",
    icon: Bug,
    match: (p: string) => p.includes("/issues"),
  },
  {
    href: "#performance",
    label: "Performance",
    icon: ChartLine,
    match: (p: string) => p.includes("/performance"),
  },
  {
    href: "#uptime",
    label: "Uptime",
    icon: Pulse,
    match: (p: string) => p.includes("/uptime"),
  },
  {
    href: "#ai",
    label: "AI",
    icon: Brain,
    match: (p: string) => p.includes("/ai"),
  },
  {
    href: "#explore",
    label: "Explore",
    icon: Compass,
    match: (p: string) => p.includes("/overview"),
  },
    {
      href: "/team",
      label: "Team",
      icon: Users,
      match: (p: string) => p.startsWith("/team"),
    },
    {
      href: "/docs/overview",
      label: "Docs",
      icon: BookOpen,
      match: (p: string) => p.startsWith("/docs"),
    },
  ];

const orgLevelLinks = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: House,
    match: (p: string) => p === "/dashboard",
  },
  {
    href: "/releases",
    label: "Releases",
    icon: Tag,
    match: (p: string) => p.startsWith("/releases"),
  },
  {
    href: "/alerts",
    label: "Alerts",
    icon: BellRinging,
    match: (p: string) => p.startsWith("/alerts"),
  },
  {
    href: "/team",
    label: "Team",
    icon: Users,
    match: (p: string) => p.startsWith("/team"),
  },
  {
    href: "/settings/audit-log",
    label: "Audit log",
    icon: ClipboardText,
    match: (p: string) => p.startsWith("/settings/audit-log"),
  },
  {
    href: "/settings/retention",
    label: "Retention",
    icon: Archive,
    match: (p: string) => p.startsWith("/settings/retention"),
  },
  {
    href: "/docs/overview",
    label: "Docs",
    icon: BookOpen,
    match: (p: string) => p.startsWith("/docs"),
  },
];

function resolveIconHref(link: (typeof iconLinks)[number], projectId: string | undefined) {
  if (link.href === "#issues" && projectId) return `/projects/${projectId}/issues`;
  if (link.href === "#performance" && projectId) return `/projects/${projectId}/performance`;
  if (link.href === "#uptime" && projectId) return `/projects/${projectId}/uptime`;
  if (link.href === "#ai" && projectId) return `/projects/${projectId}/ai`;
  if (link.href === "#explore" && projectId) return `/projects/${projectId}/overview`;
  if (link.href.startsWith("#")) return projectId ? `/projects/${projectId}/overview` : "/dashboard";
  return link.href;
}

export function AppSidebar({ userInitials }: AppSidebarProps) {
  const pathname = usePathname();
  const { project } = useSidebarProject();
  const projectId = project?.projectId;

  return (
    <>
      <aside className="dash-icon-rail" aria-label="Main navigation">
        <Link href="/dashboard" className="dash-logo" aria-label="Open Sentry home">
          <Bug size={20} weight="bold" />
        </Link>

        <nav className="dash-icon-nav">
          {iconLinks.map((link) => {
            const href = resolveIconHref(link, projectId);
            const active = link.match(pathname);
            const Icon = link.icon;
            return (
              <Link
                key={link.label}
                href={href}
                className={`dash-icon-btn ${active ? "active" : ""}`}
                title={link.label}
                aria-label={link.label}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={20} weight="bold" />
              </Link>
            );
          })}
        </nav>

        <div className="dash-icon-rail-bottom">
          <button type="button" className="dash-icon-btn" title="Search" aria-label="Search">
            <MagnifyingGlass size={20} weight="bold" />
          </button>
          <Link href="/docs/overview" className="dash-icon-btn" title="Help" aria-label="Help">
            <Question size={20} weight="bold" />
          </Link>
          <ThemeToggle compact />
          <div className="dash-user-avatar" title="Account">
            {userInitials}
          </div>
        </div>
      </aside>

      <aside className="dash-sidebar-panel" aria-label="Section navigation">
        {projectId && project ? (
          <ProjectPanel projectId={projectId} projectName={project.projectName} />
        ) : (
          <WorkspacePanel pathname={pathname} />
        )}
      </aside>
    </>
  );
}

function WorkspacePanel({ pathname }: { pathname: string }) {
  return (
    <>
      <div className="dash-panel-header">
        <span className="dash-panel-title">Workspace</span>
        <button type="button" className="dash-collapse-btn" aria-label="Collapse sidebar">
          <CaretDoubleLeft size={14} weight="bold" />
        </button>
      </div>
      <nav className="dash-panel-nav">
        {orgLevelLinks.map(({ href, label, match }) => (
          <Link
            key={label}
            href={href}
            className={`dash-panel-link ${match(pathname) ? "active" : ""}`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}

function ProjectPanel({ projectId, projectName }: { projectId: string; projectName: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") ?? "";
  const level = searchParams.get("level") ?? "";
  const onIssues = pathname.includes("/issues");

  const issueLinks = [
    { href: `/projects/${projectId}/issues`, label: "Feed", active: onIssues && !status && !level },
    {
      href: `/projects/${projectId}/issues?status=open`,
      label: "Unresolved",
      active: onIssues && status === "open",
    },
    {
      href: `/projects/${projectId}/issues?level=error`,
      label: "Errors",
      active: onIssues && level === "error",
    },
    {
      href: `/projects/${projectId}/issues?level=warning`,
      label: "Warnings",
      active: onIssues && level === "warning",
    },
  ];

  const projectLinks = [
    {
      href: `/projects/${projectId}/overview`,
      label: "Overview",
      icon: SquaresFour,
      active: pathname.endsWith("/overview"),
    },
    {
      href: `/projects/${projectId}/performance`,
      label: "Performance",
      icon: ChartLine,
      active: pathname.includes("/performance"),
    },
    {
      href: `/projects/${projectId}/releases`,
      label: "Releases",
      icon: Tag,
      active: pathname.includes("/releases"),
    },
    {
      href: `/projects/${projectId}/uptime`,
      label: "Uptime",
      icon: Pulse,
      active: pathname.includes("/uptime"),
    },
    {
      href: `/projects/${projectId}/ai`,
      label: "AI analytics",
      icon: Brain,
      active: pathname.includes("/ai"),
    },
    {
      href: `/projects/${projectId}/settings`,
      label: "Settings",
      icon: Gear,
      active: pathname.includes("/settings"),
    },
  ];

  return (
    <>
      <div className="dash-panel-header">
        <Link href="/dashboard" className="dash-panel-back">
          All projects
        </Link>
        <button type="button" className="dash-collapse-btn" aria-label="Collapse sidebar">
          <CaretDoubleLeft size={14} weight="bold" />
        </button>
      </div>
      <p className="dash-project-name">{projectName}</p>

      <nav className="dash-panel-nav">
        <p className="dash-panel-section">Issues</p>
        {issueLinks.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className={`dash-panel-link ${link.active ? "active" : ""}`}
          >
            {link.label}
          </Link>
        ))}

        <p className="dash-panel-section dash-panel-section-spaced">Project</p>
        {projectLinks.map(({ href, label, icon: Icon, active }) => (
          <Link key={label} href={href} className={`dash-panel-link with-icon ${active ? "active" : ""}`}>
            <Icon size={16} weight="bold" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
