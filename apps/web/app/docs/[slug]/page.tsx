import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsMarkdown } from "@/components/docs/docs-markdown";
import { DOC_PAGES, getDocPage, loadDocMarkdown } from "@/lib/docs";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return DOC_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getDocPage(slug);
  if (!page) return { title: "Docs — Open Sentry" };
  return {
    title: `${page.title} — Open Sentry Docs`,
    description: page.description,
  };
}

export default async function DocPage({ params }: PageProps) {
  const { slug } = await params;
  const page = getDocPage(slug);
  if (!page) notFound();

  const content = await loadDocMarkdown(slug);
  if (!content) notFound();

  return (
    <>
      <div className="docs-page-intro fade-in">
        <h1>{page.title}</h1>
        <p>{page.description}</p>
      </div>
      <DocsMarkdown content={content} />
    </>
  );
}
