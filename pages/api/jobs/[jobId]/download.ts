import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import type { NextApiRequest, NextApiResponse } from "next";
import { cleanupExpiredJobs, getJob } from "@/src/server/jobs/store";
import type { OutputFormat } from "@/src/types/conversion";

const MIME_BY_FORMAT: Record<OutputFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  html: "text/html; charset=utf-8",
  txt: "text/plain; charset=utf-8"
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  await cleanupExpiredJobs();
  const job = getJob(String(req.query.jobId || ""));
  const file = job?.files.find((item) => item.id === String(req.query.fileId || ""));
  const format = String(req.query.format || "pdf") as OutputFormat;
  const outputPath = file?.outputs[format];

  if (!job || !file || !outputPath || !MIME_BY_FORMAT[format]) {
    res.status(404).json({ error: "Requested output is not available." });
    return;
  }

  const fileStats = await stat(outputPath);
  const downloadName = `${stripExtension(file.safeName)}-bionic.${format}`;
  res.setHeader("Content-Type", MIME_BY_FORMAT[format]);
  res.setHeader("Content-Length", fileStats.size);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(downloadName)}"`);
  createReadStream(outputPath).pipe(res);
}

function stripExtension(filename: string): string {
  return path.basename(filename).replace(/\.[^.]+$/, "");
}
