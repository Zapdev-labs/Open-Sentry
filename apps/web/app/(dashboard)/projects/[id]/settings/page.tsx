import { notFound } from "next/navigation";
import { getProject, buildDsn } from "@/lib/queries";
import { requireOrganizationId } from "@/lib/session-org";
import { ProjectNav } from "@/components/project-nav";
import { CopyDsn } from "@/components/copy-dsn";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SettingsPage({ params }: PageProps) {
  const { id } = await params;
  const organizationId = await requireOrganizationId();
  const project = await getProject(id, organizationId);
  if (!project) notFound();

  const dsn = buildDsn(project.publicKey);
  const installCode = `import { init, captureException } from "@zapdev-labs/sentry-clone";

init({
  dsn: "${dsn}",
  environment: "production",
  release: "1.0.0",
});

try {
  // your code
} catch (error) {
  captureException(error);
}`;

  return (
    <main>
      <ProjectNav projectId={id} active="settings" />

      <section className="container" style={{ paddingBottom: 64 }}>
        <div className="fade-in" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 24, marginBottom: 8 }}>Project settings</h2>
          <p className="meta">Configure your SDK with the DSN below.</p>
        </div>

        <div className="card fade-in" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>DSN</h3>
          <CopyDsn dsn={dsn} />
        </div>

        <div className="window-chrome fade-in">
          <div className="window-chrome-bar">
            <span className="window-dot" />
            <span className="window-dot" />
            <span className="window-dot" />
            <span style={{ marginLeft: 8, fontSize: 13, color: "var(--text-muted)" }}>
              install.ts
            </span>
          </div>
          <div className="window-chrome-body">
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{installCode}</pre>
          </div>
        </div>

        <div className="card fade-in" style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>Public key</h3>
          <code className="code-block">{project.publicKey}</code>
        </div>
      </section>
    </main>
  );
}
