import { readFile } from "node:fs/promises";
import type { AcceptedExtension, ParsedDocument } from "@/src/types/conversion";

export async function parsePlainText(filePath: string, sourceType: AcceptedExtension, title: string): Promise<ParsedDocument> {
  const text = await readFile(filePath, "utf8");
  return {
    title,
    sourceType,
    html: `<div class="br-plain-text">${escapeHtml(text)}</div>`,
    text,
    warnings: []
  };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
