import { writeFile } from "node:fs/promises";
import htmlToDocx from "html-to-docx";
import { buildStandaloneHtml } from "@/src/server/exporters/html";

export async function writeDocxOutput(filePath: string, contentHtml: string, title: string, sourceName: string): Promise<void> {
  const html = buildStandaloneHtml(contentHtml, { title, sourceName });
  const buffer = await htmlToDocx(html, null, {
    table: {
      row: {
        cantSplit: true
      }
    },
    footer: false,
    pageNumber: false,
    margins: {
      top: 720,
      right: 720,
      bottom: 720,
      left: 720
    }
  });

  await writeFile(filePath, toBuffer(buffer));
}

function toBuffer(value: Buffer | ArrayBuffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(value));
  }

  return Buffer.from(value);
}
