import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ParsedDocument } from "@/src/types/conversion";

interface PdfTextItem {
  str: string;
  width: number;
  height: number;
  transform: number[];
  hasEOL?: boolean;
  fontName?: string;
}

export async function parsePdf(filePath: string, title = path.basename(filePath)): Promise<ParsedDocument> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await readFile(filePath));
  const loadingTask = pdfjs.getDocument({
    data,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: true
  });
  const pdf = await loadingTask.promise;
  const pageHtml: string[] = [];
  const textParts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.333333 });
    const textContent = await page.getTextContent({
      includeMarkedContent: false,
      disableCombineTextItems: false
    });

    const spans: string[] = [];

    for (const item of textContent.items as PdfTextItem[]) {
      if (!item.str) {
        continue;
      }

      const tx = pdfjs.Util.transform(viewport.transform, item.transform);
      const fontSize = Math.max(6, Math.hypot(tx[2], tx[3]));
      const left = tx[4];
      const top = tx[5] - fontSize;
      const angle = Math.atan2(tx[1], tx[0]);
      const width = Math.max(1, item.width * viewport.scale);
      const safeText = escapeHtml(item.str);

      spans.push(
        `<span class="pdf-text" style="left:${round(left)}px;top:${round(top)}px;font-size:${round(fontSize)}px;width:${round(width)}px;transform:rotate(${round(angle)}rad);">${safeText}</span>`
      );

      textParts.push(item.str);
      if (item.hasEOL) {
        textParts.push("\n");
      }
    }

    textParts.push("\n\n");
    pageHtml.push(
      `<section class="pdf-page" data-page="${pageNumber}" style="width:${round(viewport.width)}px;height:${round(viewport.height)}px">${spans.join("")}</section>`
    );

    page.cleanup();
  }

  await pdf.destroy();

  return {
    title,
    sourceType: "pdf",
    html: `<div class="pdf-pages">${pageHtml.join("\n")}</div>`,
    text: textParts.join(""),
    pageCount: pdf.numPages,
    warnings: [
      "PDF layout is reconstructed from text coordinates. Scanned image-only pages require OCR before conversion."
    ]
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
