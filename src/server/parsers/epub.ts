import path from "node:path";
import { readFile } from "node:fs/promises";
import * as cheerio from "cheerio";
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import type { ParsedDocument } from "@/src/types/conversion";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "text",
  parseTagValue: false
});

export async function parseEpub(filePath: string, fallbackTitle: string): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(await readFile(filePath));
  const containerXml = await readZipText(zip, "META-INF/container.xml");
  const container = xmlParser.parse(containerXml);
  const rootFile = arrayify(container?.container?.rootfiles?.rootfile)[0];
  const opfPath = rootFile?.["full-path"];

  if (!opfPath) {
    throw new Error("EPUB container is missing the OPF package path.");
  }

  const opf = xmlParser.parse(await readZipText(zip, opfPath));
  const packageRoot = opf.package;
  const manifestItems = arrayify(packageRoot?.manifest?.item);
  const spineItems = arrayify(packageRoot?.spine?.itemref);
  const manifestById = new Map<string, Record<string, string>>();

  for (const item of manifestItems) {
    if (item?.id) {
      manifestById.set(item.id, item);
    }
  }

  const opfDir = path.posix.dirname(opfPath);
  const title =
    extractTextValue(packageRoot?.metadata?.["dc:title"]) ||
    extractTextValue(packageRoot?.metadata?.title) ||
    fallbackTitle;

  const chapters: string[] = [];
  const textParts: string[] = [];

  for (const spine of spineItems) {
    const manifest = manifestById.get(spine.idref);
    if (!manifest?.href) {
      continue;
    }

    const chapterPath = normalizeZipPath(path.posix.join(opfDir, manifest.href));
    const chapterHtml = await readZipText(zip, chapterPath);
    const $ = cheerio.load(chapterHtml, { xmlMode: false });
    const bodyHtml = $("body").html() || $.root().html() || "";
    if (bodyHtml.trim()) {
      chapters.push(`<section class="epub-chapter">${bodyHtml}</section>`);
      textParts.push($("body").text() || $.text());
    }
  }

  return {
    title,
    sourceType: "epub",
    html: `<article class="epub-document">${chapters.join("\n")}</article>`,
    text: textParts.join("\n\n"),
    warnings: chapters.length ? [] : ["No readable XHTML chapters were found in the EPUB spine."]
  };
}

async function readZipText(zip: JSZip, zipPath: string): Promise<string> {
  const normalized = normalizeZipPath(zipPath);
  const entry = zip.file(normalized);
  if (!entry) {
    throw new Error(`EPUB entry "${normalized}" was not found.`);
  }

  return entry.async("text");
}

function normalizeZipPath(zipPath: string): string {
  return zipPath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function arrayify<T>(value: T | T[] | undefined | null): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function extractTextValue(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return extractTextValue(value[0]);
  }

  if (typeof value === "object" && value && "text" in value) {
    const text = (value as { text?: unknown }).text;
    return typeof text === "string" ? text : undefined;
  }

  return undefined;
}
