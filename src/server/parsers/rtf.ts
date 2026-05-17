import { readFile } from "node:fs/promises";
import type { ParsedDocument } from "@/src/types/conversion";

export async function parseRtf(filePath: string, title: string): Promise<ParsedDocument> {
  const buffer = await readFile(filePath);
  const html = await rtfToHtmlString(buffer);
  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);

  return {
    title,
    sourceType: "rtf",
    html: $("body").html() || html,
    text: $.text(),
    warnings: []
  };
}

function rtfToHtmlString(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    void import("@iarna/rtf-to-html")
      .then(({ default: rtfToHtml }) => {
        rtfToHtml.fromString(buffer, (error, html) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(html ?? "");
        });
      })
      .catch(reject);
  });
}
