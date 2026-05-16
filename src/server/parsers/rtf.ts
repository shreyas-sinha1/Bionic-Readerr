import { readFile } from "node:fs/promises";
import * as cheerio from "cheerio";
import rtfToHtml from "@iarna/rtf-to-html";
import type { ParsedDocument } from "@/src/types/conversion";

export async function parseRtf(filePath: string, title: string): Promise<ParsedDocument> {
  const buffer = await readFile(filePath);
  const html = await rtfToHtmlString(buffer);
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
    rtfToHtml.fromString(buffer, (error, html) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(html ?? "");
    });
  });
}
