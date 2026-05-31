"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateProjectForm() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });

    if (res.ok) {
      const project = (await res.json()) as { id: string };
      router.push(`/projects/${project.id}/overview`);
      router.refresh();
    } else {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
        <label htmlFor="project-name">Project name</label>
        <input
          id="project-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Application"
          required
        />
      </div>
      <button type="submit" className="btn" disabled={loading}>
        {loading ? "Creating..." : "Create project"}
      </button>
    </form>
  );
}
