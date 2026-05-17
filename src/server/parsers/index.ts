import path from "node:path";
import type { AcceptedExtension, ParsedDocument } from "@/src/types/conversion";

export async function parseSourceDocument(filePath: string, extension: AcceptedExtension, originalName: string): Promise<ParsedDocument> {
  const title = path.parse(originalName).name;

  switch (extension) {
    case "pdf": {
      const { parsePdf } = await import("@/src/server/parsers/pdf");
      return parsePdf(filePath, title);
    }
    case "txt": {
      const { parsePlainText } = await import("@/src/server/parsers/text");
      return parsePlainText(filePath, "txt", title);
    }
    case "docx": {
      const { parseDocx } = await import("@/src/server/parsers/docx");
      return parseDocx(filePath, title);
    }
    case "md": {
      const { parseMarkdown } = await import("@/src/server/parsers/markdown");
      return parseMarkdown(filePath, title);
    }
    case "epub": {
      const { parseEpub } = await import("@/src/server/parsers/epub");
      return parseEpub(filePath, title);
    }
    case "rtf": {
      const { parseRtf } = await import("@/src/server/parsers/rtf");
      return parseRtf(filePath, title);
    }
    default:
      throw new Error(`Unsupported parser for ".${extension}".`);
  }
}
