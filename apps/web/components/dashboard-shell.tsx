import Link from "next/link";
import { Bug } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { OrgSwitcher } from "@/components/org-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

const navLinks = [
  { href: "/", label: "Overview" },
  { href: "/team", label: "Team" },
  { href: "/docs/overview", label: "Docs" },
];

export async function DashboardShell({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  const organizations = session
    ? await auth.api.listOrganizations({ headers: requestHeaders })
    : [];

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <div className="dashboard-header-left">
            <Link href="/" className="dashboard-brand">
              <Bug size={22} weight="bold" />
              <span>Open Sentry</span>
            </Link>
            {session && organizations.length > 0 && (
              <OrgSwitcher
                organizations={organizations}
                activeOrganizationId={session.session.activeOrganizationId ?? null}
              />
            )}
          </div>
          <nav className="dashboard-nav">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="dashboard-nav-link">
                {link.label}
              </Link>
            ))}
          </nav>
          {session && (
            <div className="dashboard-header-actions">
              <ThemeToggle />
              <UserMenu
                name={session.user.name}
                email={session.user.email}
                image={session.user.image}
              />
            </div>
          )}
          {!session && <ThemeToggle />}
        </div>
      </header>
      <div className="dashboard-content">{children}</div>
    </div>
  );
}
