"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface ProjectScopeValue {
  projectId: string;
  projectName: string;
}

interface SidebarProjectContextValue {
  project: ProjectScopeValue | null;
  setProject: (project: ProjectScopeValue | null) => void;
}

const SidebarProjectContext = createContext<SidebarProjectContextValue | null>(null);

export function SidebarProjectProvider({ children }: { children: React.ReactNode }) {
  const [project, setProject] = useState<ProjectScopeValue | null>(null);

  return (
    <SidebarProjectContext.Provider value={{ project, setProject }}>
      {children}
    </SidebarProjectContext.Provider>
  );
}

export function useSidebarProject() {
  const context = useContext(SidebarProjectContext);
  if (!context) {
    throw new Error("useSidebarProject must be used within SidebarProjectProvider");
  }
  return context;
}

export function ProjectScopeRegistrar({ projectId, projectName }: ProjectScopeValue) {
  const { setProject } = useSidebarProject();

  useEffect(() => {
    setProject({ projectId, projectName });
    return () => setProject(null);
  }, [projectId, projectName, setProject]);

  return null;
}
