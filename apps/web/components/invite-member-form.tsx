"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";

export function InviteMemberForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const { organization } = useOrganization();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !organization) return;

    setLoading(true);
    setMessage("");

    try {
      await organization.inviteMember({
        emailAddress: email.trim(),
        role: role === "admin" ? "org:admin" : "org:member",
      });
      setEmail("");
      setMessage("Invitation sent");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="invite-email">Email</label>
        <input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@company.com"
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="invite-role">Role</label>
        <select
          id="invite-role"
          className="filter-select"
          value={role}
          onChange={(e) => setRole(e.target.value as "member" | "admin")}
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {message && <p className="meta" style={{ marginBottom: 12 }}>{message}</p>}
      <button type="submit" className="btn" disabled={loading}>
        {loading ? "Sending..." : "Send invitation"}
      </button>
    </form>
  );
}
