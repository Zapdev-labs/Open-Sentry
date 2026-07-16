import { notFound } from "next/navigation";
import Link from "next/link";
import { ensureActiveOrganization } from "@/lib/session-org";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { InviteMemberForm } from "@/components/invite-member-form";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const orgContext = await ensureActiveOrganization();
  if (!orgContext) notFound();

  const requestHeaders = await headers();
  const org = await auth.api.getFullOrganization({ headers: requestHeaders });

  if (!org) notFound();

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
            {org.members.length === 0 ? (
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
                  {org.members.map((member) => (
                    <tr key={member.id}>
                      <td style={{ fontWeight: 500 }}>{member.user.name}</td>
                      <td className="meta">{member.user.email}</td>
                      <td>
                        <span className="badge badge-level-info">{member.role}</span>
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
            {org.invitations.length > 0 && (
              <>
                <h3 style={{ fontSize: 16, marginTop: 32, marginBottom: 12 }}>Pending invitations</h3>
                <ul className="activity-feed">
                  {org.invitations.map((invitation) => (
                    <li key={invitation.id} className="activity-item">
                      <div>
                        <p className="activity-message">{invitation.email}</p>
                        <span className="meta">{invitation.role ?? "member"}</span>
                      </div>
                      <span className={`badge badge-${invitation.status === "pending" ? "open" : "resolved"}`}>
                        {invitation.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
