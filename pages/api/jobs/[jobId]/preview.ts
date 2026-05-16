import { readFile } from "node:fs/promises";
import type { NextApiRequest, NextApiResponse } from "next";
import { cleanupExpiredJobs, getJob } from "@/src/server/jobs/store";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  await cleanupExpiredJobs();
  const job = getJob(String(req.query.jobId || ""));
  const file = job?.files.find((item) => item.id === String(req.query.fileId || ""));

  if (!job || !file?.outputs.html) {
    res.status(404).json({ error: "Preview not found." });
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "private, max-age=60");
  res.status(200).send(await readFile(file.outputs.html, "utf8"));
}
