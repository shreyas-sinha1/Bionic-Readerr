import archiver from "archiver";
import type { NextApiRequest, NextApiResponse } from "next";
import path from "node:path";
import { cleanupExpiredJobs, getJob } from "@/src/server/jobs/store";
import type { OutputFormat } from "@/src/types/conversion";

export const config = {
  api: {
    responseLimit: false
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  await cleanupExpiredJobs();
  const job = getJob(String(req.query.jobId || ""));
  const format = String(req.query.format || "pdf") as OutputFormat;

  if (!job || !["pdf", "docx", "html", "txt"].includes(format)) {
    res.status(404).json({ error: "Job or output format not found." });
    return;
  }

  const available = job.files.filter((file) => file.outputs[format]);
  if (!available.length) {
    res.status(404).json({ error: "No files are available in this format." });
    return;
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="bionic-reader-${job.id.slice(0, 8)}-${format}.zip"`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (error) => {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.destroy(error);
    }
  });

  archive.pipe(res);

  for (const file of available) {
    const outputPath = file.outputs[format]!;
    archive.file(outputPath, {
      name: `${stripExtension(file.safeName)}-bionic.${format}`
    });
  }

  await archive.finalize();
}

function stripExtension(filename: string): string {
  return path.basename(filename).replace(/\.[^.]+$/, "");
}
