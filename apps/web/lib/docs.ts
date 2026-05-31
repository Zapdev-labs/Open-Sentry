import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getDocPage, type DocPage } from "./docs-config";

const DOCS_ROOT = join(process.cwd(), "../../docs");

export type { DocPage };
export { DOC_PAGES, getDocPage, resolveDocHref } from "./docs-config";

export async function loadDocMarkdown(slug: string): Promise<string | null> {
  const page = getDocPage(slug);
  if (!page) return null;
  return readFile(join(DOCS_ROOT, page.file), "utf8");
}
