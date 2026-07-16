import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { OrganizationList } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/login");
  if (orgId) redirect("/dashboard");

  return (
    <main className="auth-page">
      <div className="auth-card fade-in" style={{ maxWidth: 520 }}>
        <div className="auth-header">
          <div className="auth-header-row">
            <h1>Create a workspace</h1>
            <ThemeToggle />
          </div>
          <p className="meta">
            Sign-in worked, but you need a Clerk organization before projects show up. If you used
            Open Sentry before the Clerk migration, create (or join) an org with the same email —
            we will attach your existing projects automatically.
          </p>
        </div>
        <OrganizationList
          hidePersonal
          afterSelectOrganizationUrl="/dashboard"
          afterCreateOrganizationUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: { width: "100%" },
              card: { boxShadow: "none", border: "none", padding: 0, background: "transparent" },
            },
          }}
        />
      </div>
    </main>
  );
}
