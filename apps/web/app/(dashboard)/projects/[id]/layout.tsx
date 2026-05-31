import { notFound } from "next/navigation";
import { getProject } from "@/lib/queries";
import { requireOrganizationId } from "@/lib/session-org";
import { ProjectScopeRegistrar } from "@/components/project-scope";

export const dynamic = "force-dynamic";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { id } = await params;
  const organizationId = await requireOrganizationId();
  const project = await getProject(id, organizationId);
  if (!project) notFound();

  return (
    <>
      <ProjectScopeRegistrar projectId={id} projectName={project.name} />
      {children}
    </>
  );
}
