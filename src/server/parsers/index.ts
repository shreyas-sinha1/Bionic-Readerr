import path from "node:path";
import type { AcceptedExtension, ParsedDocument } from "@/src/types/conversion";
import { parseDocx } from "@/src/server/parsers/docx";
import { parseEpub } from "@/src/server/parsers/epub";
import { parseMarkdown } from "@/src/server/parsers/markdown";
import { parsePdf } from "@/src/server/parsers/pdf";
import { parsePlainText } from "@/src/server/parsers/text";
import { parseRtf } from "@/src/server/parsers/rtf";

export async function parseSourceDocument(filePath: string, extension: AcceptedExtension, originalName: string): Promise<ParsedDocument> {
  const title = path.parse(originalName).name;

  switch (extension) {
    case "pdf":
      return parsePdf(filePath, title);
    case "txt":
      return parsePlainText(filePath, "txt", title);
    case "docx":
      return parseDocx(filePath, title);
    case "md":
      return parseMarkdown(filePath, title);
    case "epub":
      return parseEpub(filePath, title);
    case "rtf":
      return parseRtf(filePath, title);
    default:
      throw new Error(`Unsupported parser for ".${extension}".`);
  }
}
