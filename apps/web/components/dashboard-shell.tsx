import { Suspense } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { AppSidebar } from "@/components/app-sidebar";
import { OrgSwitcher } from "@/components/org-switcher";
import { SidebarProjectProvider } from "@/components/project-scope";

export async function DashboardShell({ children }: { children: React.ReactNode }) {
  const { userId, orgId } = await auth();
  const user = await currentUser();
  const userInitials = (user?.firstName ?? user?.username ?? "?").charAt(0).toUpperCase();

  return (
    <SidebarProjectProvider>
      <div className="dash-layout">
        <Suspense fallback={<aside className="dash-icon-rail" />}>
          <AppSidebar userInitials={userInitials} />
        </Suspense>

        <div className="dash-main">
          {userId && orgId && (
            <div className="dash-topbar">
              <Suspense fallback={null}>
                <OrgSwitcher activeOrganizationId={orgId} />
              </Suspense>
            </div>
          )}
          <div className="dash-content">{children}</div>
        </div>
      </div>
    </SidebarProjectProvider>
  );
}
