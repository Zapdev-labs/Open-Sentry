"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { organization } from "@/lib/auth-client";

export function InviteMemberForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setMessage("");

    const result = await organization.inviteMember({
      email: email.trim(),
      role,
    });

    if (result.error) {
      setMessage(result.error.message ?? "Failed to send invitation");
      setLoading(false);
      return;
    }

    setEmail("");
    setMessage("Invitation sent");
    setLoading(false);
    router.refresh();
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
