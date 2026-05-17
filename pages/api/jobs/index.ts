import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import type { IncomingHttpHeaders } from "node:http";
import path from "node:path";
import Busboy from "busboy";
import type { NextApiRequest, NextApiResponse } from "next";
import { addFileToJob, cleanupExpiredJobs, createJob, deleteJob, serializeJob, updateJob } from "@/src/server/jobs/store";
import type { InternalFileJob } from "@/src/server/jobs/types";
import {
  getMaxBatchFiles,
  getMaxUploadBytes,
  validateUpload
} from "@/src/server/security/fileValidation";
import type { BionicOptions, Intensity } from "@/src/types/conversion";

export const config = {
  runtime: "nodejs",
  api: {
    bodyParser: false,
    responseLimit: false
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  await cleanupExpiredJobs();

  let job = await createJob({ intensity: "medium" });

  try {
    const { fields, files } = await parseMultipart(req, job.id, job.inputDir);
    const options = parseOptions(fields);

    updateJob(job.id, {
      options,
      status: "queued",
      progress: 0
    });

    if (!files.length) {
      throw new Error("Upload at least one supported file.");
    }

    for (const file of files) {
      addFileToJob(job.id, file);
    }

    const publicJob = serializeJob(job);
    res.status(202).json(publicJob);

    void import("@/src/server/jobs/processor")
      .then(({ enqueueJob }) => enqueueJob(job.id))
      .catch((error) => {
        console.error("Failed to start conversion worker", error);
        updateJob(job.id, {
          status: "error",
          progress: 100,
          error: error instanceof Error ? error.message : "Failed to start conversion worker"
        });
      });
  } catch (error) {
    await deleteJob(job.id).catch(() => undefined);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Upload failed"
    });
  }
}

function parseOptions(fields: Record<string, string>): BionicOptions {
  const intensity = fields.intensity;
  const allowed: Intensity[] = ["weak", "medium", "strong"];

  return {
    intensity: allowed.includes(intensity as Intensity) ? (intensity as Intensity) : "medium"
  };
}

function parseMultipart(
  req: NextApiRequest,
  jobId: string,
  inputDir: string
): Promise<{ fields: Record<string, string>; files: InternalFileJob[] }> {
  return new Promise((resolve, reject) => {
    const fields: Record<string, string> = {};
    const files: InternalFileJob[] = [];
    const pendingWrites = new Set<Promise<void>>();
    let rejected = false;

    const busboy = Busboy({
      headers: req.headers as IncomingHttpHeaders,
      limits: {
        fileSize: getMaxUploadBytes(),
        files: getMaxBatchFiles()
      }
    });

    const fail = (error: Error): void => {
      if (rejected) {
        return;
      }

      rejected = true;
      reject(error);
    };

    busboy.on("field", (name, value) => {
      fields[name] = String(value);
    });

    busboy.on("filesLimit", () => {
      fail(new Error(`Batch limit exceeded. Upload at most ${getMaxBatchFiles()} files at once.`));
    });

    busboy.on("file", (_fieldName, stream, info) => {
      let validation: ReturnType<typeof validateUpload>;

      try {
        validation = validateUpload(info.filename, info.mimeType);
      } catch (error) {
        stream.resume();
        fail(error instanceof Error ? error : new Error("Invalid upload."));
        return;
      }

      const fileId = randomUUID();
      const inputPath = path.join(inputDir, `${fileId}.${validation.extension}`);
      let sizeBytes = 0;
      let hitLimit = false;

      const writeStream = createWriteStream(inputPath, { flags: "wx" });
      const writePromise = new Promise<void>((resolveWrite, rejectWrite) => {
        stream.on("data", (chunk: Buffer) => {
          sizeBytes += chunk.length;
        });

        stream.on("limit", () => {
          hitLimit = true;
          rejectWrite(new Error(`"${info.filename}" exceeds the ${Math.round(getMaxUploadBytes() / 1024 / 1024)} MB limit.`));
        });

        writeStream.on("finish", () => {
          if (hitLimit) {
            return;
          }

          files.push({
            id: fileId,
            originalName: info.filename,
            safeName: validation.safeName,
            extension: validation.extension,
            mimeType: info.mimeType,
            sizeBytes,
            inputPath,
            status: "queued",
            progress: 0,
            message: "Waiting to process",
            warnings: [],
            outputs: {}
          });
          resolveWrite();
        });

        writeStream.on("error", rejectWrite);
        stream.on("error", rejectWrite);
      });

      pendingWrites.add(writePromise);
      writePromise.catch(fail).finally(() => pendingWrites.delete(writePromise));
      stream.pipe(writeStream);
    });

    busboy.on("error", fail);
    busboy.on("finish", () => {
      Promise.all([...pendingWrites])
        .then(() => {
          if (!rejected) {
            resolve({ fields, files });
          }
        })
        .catch((error) => fail(error instanceof Error ? error : new Error("Upload failed.")));
    });

    req.pipe(busboy);
  });
}
