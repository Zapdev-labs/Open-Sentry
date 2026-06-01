import { notFound } from "next/navigation";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { InviteMemberForm } from "@/components/invite-member-form";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { orgId } = await auth();
  if (!orgId) notFound();

  const client = await clerkClient();
  const [org, memberships] = await Promise.all([
    client.organizations.getOrganization({ organizationId: orgId }),
    client.organizations.getOrganizationMembershipList({ organizationId: orgId }),
  ]);

  return (
    <main className="dash-page">
      <header className="dash-page-header fade-in">
        <h1 className="dash-page-title">Team</h1>
      </header>
      <p className="meta fade-in" style={{ marginBottom: 24 }}>
        Manage members and invitations for {org.name}.
      </p>

      <section style={{ paddingBottom: 64 }}>
        <div className="two-col">
          <div className="card fade-in">
            <h2 style={{ fontSize: 20, marginBottom: 16 }}>Members</h2>
            {memberships.data.length === 0 ? (
              <p className="meta">No members yet.</p>
            ) : (
              <table className="table-editorial">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {memberships.data.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 500 }}>
                        {m.publicUserData?.firstName
                          ? `${m.publicUserData.firstName}${m.publicUserData.lastName ? ` ${m.publicUserData.lastName}` : ""}`
                          : m.publicUserData?.identifier ?? "—"}
                      </td>
                      <td className="meta">{m.publicUserData?.identifier ?? "—"}</td>
                      <td>
                        <span className="badge badge-level-info">{m.role.replace("org:", "")}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card fade-in">
            <h2 style={{ fontSize: 20, marginBottom: 16 }}>Invite member</h2>
            <InviteMemberForm />
          </div>
        </div>
      </section>
    </main>
  );
}
