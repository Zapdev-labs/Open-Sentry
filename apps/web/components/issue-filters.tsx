"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const statuses = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "ignored", label: "Ignored" },
];

const levels = [
  { value: "", label: "All levels" },
  { value: "fatal", label: "Fatal" },
  { value: "error", label: "Error" },
  { value: "warning", label: "Warning" },
];

interface IssueFiltersProps {
  projectId: string;
}

export function IssueFilters({ projectId: _projectId }: IssueFiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") ?? "";
  const level = searchParams.get("level") ?? "";

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="filter-bar">
      <div className="filter-group">
        {statuses.map((item) => (
          <button
            key={item.value || "all"}
            type="button"
            className={`filter-chip ${status === item.value ? "active" : ""}`}
            onClick={() => updateFilter("status", item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <select
        className="filter-select"
        value={level}
        onChange={(e) => updateFilter("level", e.target.value)}
        aria-label="Filter by level"
      >
        {levels.map((item) => (
          <option key={item.value || "all"} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
