import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { AppSidebar } from "@/components/app-sidebar";
import { OrgSwitcher } from "@/components/org-switcher";
import { SidebarProjectProvider } from "@/components/project-scope";

export async function DashboardShell({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  const organizations = session
    ? await auth.api.listOrganizations({ headers: requestHeaders })
    : [];

  const userInitials = session?.user.name?.charAt(0).toUpperCase() ?? "?";

  return (
    <SidebarProjectProvider>
      <div className="dash-layout">
        <Suspense fallback={<aside className="dash-icon-rail" />}>
          <AppSidebar userInitials={userInitials} />
        </Suspense>

        <div className="dash-main">
          {session && organizations.length > 0 && (
            <div className="dash-topbar">
              <Suspense fallback={null}>
                <OrgSwitcher
                  organizations={organizations}
                  activeOrganizationId={session.session.activeOrganizationId ?? null}
                />
              </Suspense>
            </div>
          )}
          <div className="dash-content">{children}</div>
        </div>
      </div>
    </SidebarProjectProvider>
  );
}
