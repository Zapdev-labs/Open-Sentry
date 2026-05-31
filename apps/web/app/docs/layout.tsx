import { DocsHeader } from "@/components/docs/docs-header";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import "./docs.css";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="docs-shell">
      <DocsHeader />
      <div className="docs-layout">
        <DocsSidebar />
        <main className="docs-main">{children}</main>
      </div>
    </div>
  );
}
