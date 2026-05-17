import type { NextApiRequest, NextApiResponse } from "next";
import { cleanupExpiredJobs, getJob, serializeJob } from "@/src/server/jobs/store";

export const config = {
  runtime: "nodejs"
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  await cleanupExpiredJobs();
  const jobId = String(req.query.jobId || "");
  const job = getJob(jobId);

  if (!job) {
    res.status(404).json({ error: "Job not found or expired." });
    return;
  }

  res.status(200).json(serializeJob(job));
}
