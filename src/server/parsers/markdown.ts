import { readFile } from "node:fs/promises";
import { marked } from "marked";
import type { ParsedDocument } from "@/src/types/conversion";

export async function parseMarkdown(filePath: string, title: string): Promise<ParsedDocument> {
  const markdown = await readFile(filePath, "utf8");
  const html = await marked.parse(markdown, {
    async: false,
    breaks: false,
    gfm: true
  });

  return {
    title,
    sourceType: "md",
    html: `<article class="markdown-body">${html}</article>`,
    text: markdown,
    warnings: []
  };
}
