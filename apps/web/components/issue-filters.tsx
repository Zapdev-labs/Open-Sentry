"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CaretDown, MagnifyingGlass, X } from "@phosphor-icons/react";

const statuses = [
  { value: "", label: "All statuses" },
  { value: "open", label: "Unresolved" },
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
  projectName: string;
}

export function IssueFilters({ projectId: _projectId, projectName }: IssueFiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") ?? "";
  const level = searchParams.get("level") ?? "";
  const query = searchParams.get("q") ?? "";

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearFilter(key: string) {
    updateParams({ [key]: "" });
  }

  const activeTags: { key: string; label: string }[] = [];
  if (status === "open") activeTags.push({ key: "status", label: "is:unresolved" });
  else if (status) activeTags.push({ key: "status", label: `status:${status}` });
  if (level) activeTags.push({ key: "level", label: `level:${level}` });
  if (query) activeTags.push({ key: "q", label: query });

  return (
    <div className="issues-toolbar">
      <div className="issues-toolbar-filters">
        <div className="issues-dropdown">
          <span>{projectName}</span>
          <CaretDown size={12} weight="bold" />
        </div>
        <div className="issues-dropdown">
          <span>All Envs</span>
          <CaretDown size={12} weight="bold" />
        </div>
        <div className="issues-dropdown">
          <span>14D</span>
          <CaretDown size={12} weight="bold" />
        </div>
      </div>

      <div className="issues-search-wrap">
        <MagnifyingGlass size={16} weight="bold" className="issues-search-icon" />
        {activeTags.map((tag) => (
          <span key={tag.key} className="issues-search-tag">
            {tag.label}
            <button
              type="button"
              onClick={() => clearFilter(tag.key)}
              aria-label={`Remove ${tag.label} filter`}
            >
              <X size={12} weight="bold" />
            </button>
          </span>
        ))}
        <input
          type="text"
          className="issues-search-input"
          placeholder={activeTags.length === 0 ? "Search issues..." : ""}
          value={query}
          onChange={(e) => updateParams({ q: e.target.value })}
          aria-label="Search issues"
        />
      </div>

      <div className="issues-toolbar-actions">
        <select
          className="issues-sort-select"
          value={status}
          onChange={(e) => updateParams({ status: e.target.value })}
          aria-label="Filter by status"
        >
          {statuses.map((item) => (
            <option key={item.value || "all"} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <select
          className="issues-sort-select"
          value={level}
          onChange={(e) => updateParams({ level: e.target.value })}
          aria-label="Filter by level"
        >
          {levels.map((item) => (
            <option key={item.value || "all"} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <button type="button" className="issues-save-btn">
          Save view
        </button>
      </div>
    </div>
  );
}
