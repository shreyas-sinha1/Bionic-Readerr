import path from "node:path";
import type { AcceptedExtension } from "@/src/types/conversion";

export const ACCEPTED_EXTENSIONS: AcceptedExtension[] = ["pdf", "txt", "docx", "md", "epub", "rtf"];

export const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/epub+zip",
  "application/rtf",
  "text/rtf",
  "application/octet-stream"
]);

export function getMaxUploadBytes(): number {
  return Number(process.env.MAX_UPLOAD_BYTES ?? 262_144_000);
}

export function getMaxBatchFiles(): number {
  return Number(process.env.MAX_BATCH_FILES ?? 12);
}

export function getJobTtlMs(): number {
  return Number(process.env.JOB_TTL_MS ?? 3_600_000);
}

export function validateUpload(filename: string, mimeType?: string): { extension: AcceptedExtension; safeName: string } {
  const extension = path.extname(filename).replace(".", "").toLowerCase() as AcceptedExtension;
  if (!ACCEPTED_EXTENSIONS.includes(extension)) {
    throw new Error(`Unsupported file type ".${extension || "unknown"}".`);
  }

  if (mimeType && !ACCEPTED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Unsupported MIME type "${mimeType}".`);
  }

  return {
    extension,
    safeName: sanitizeFilename(filename)
  };
}

export function sanitizeFilename(filename: string): string {
  const parsed = path.parse(filename);
  const base = parsed.name
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "document";
  return `${base}${parsed.ext.toLowerCase()}`;
}

export function assertPathInside(parent: string, candidate: string): void {
  const relative = path.relative(parent, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Resolved path escaped the temporary job directory.");
  }
}
