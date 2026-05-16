import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { BionicOptions } from "@/src/types/conversion";
import { getJobTtlMs } from "@/src/server/security/fileValidation";
import type { InternalConversionJob, InternalFileJob, SerializedJob } from "@/src/server/jobs/types";

const TEMP_ROOT = path.join(os.tmpdir(), "bionic-reader-converter");

interface GlobalJobState {
  jobs: Map<string, InternalConversionJob>;
  cleanupTimer?: NodeJS.Timeout;
}

const globalState = globalThis as typeof globalThis & {
  __bionicReaderJobs?: GlobalJobState;
};

export function getJobState(): GlobalJobState {
  if (!globalState.__bionicReaderJobs) {
    globalState.__bionicReaderJobs = {
      jobs: new Map()
    };
  }

  return globalState.__bionicReaderJobs;
}

export async function createJob(options: BionicOptions): Promise<InternalConversionJob> {
  const id = randomUUID();
  const rootDir = path.join(TEMP_ROOT, id);
  const inputDir = path.join(rootDir, "input");
  const outputDir = path.join(rootDir, "output");
  await mkdir(inputDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + getJobTtlMs());
  const job: InternalConversionJob = {
    id,
    status: "uploading",
    progress: 0,
    createdAt,
    expiresAt,
    rootDir,
    inputDir,
    outputDir,
    options,
    files: []
  };

  getJobState().jobs.set(id, job);
  scheduleCleanup();
  return job;
}

export function getJob(jobId: string): InternalConversionJob | undefined {
  const job = getJobState().jobs.get(jobId);
  if (!job) {
    return undefined;
  }

  if (Date.now() > job.expiresAt.getTime()) {
    void deleteJob(jobId);
    return {
      ...job,
      status: "expired",
      error: "This temporary job has expired."
    };
  }

  return job;
}

export function addFileToJob(jobId: string, file: InternalFileJob): void {
  const job = requireJob(jobId);
  job.files.push(file);
  recalculateJobProgress(job);
}

export function updateJob(jobId: string, update: Partial<InternalConversionJob>): void {
  const job = requireJob(jobId);
  Object.assign(job, update);
  recalculateJobProgress(job);
}

export function updateFile(jobId: string, fileId: string, update: Partial<InternalFileJob>): void {
  const job = requireJob(jobId);
  const file = job.files.find((item) => item.id === fileId);
  if (!file) {
    throw new Error(`File "${fileId}" was not found in job "${jobId}".`);
  }

  Object.assign(file, update);
  recalculateJobProgress(job);
}

export function serializeJob(job: InternalConversionJob): SerializedJob {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    createdAt: job.createdAt.toISOString(),
    expiresAt: job.expiresAt.toISOString(),
    error: job.error,
    files: job.files.map((file) => ({
      id: file.id,
      originalName: file.originalName,
      extension: file.extension,
      sizeBytes: file.sizeBytes,
      status: file.status,
      progress: file.progress,
      message: file.message,
      warnings: file.warnings,
      error: file.error,
      availableFormats: (Object.keys(file.outputs) as Array<keyof typeof file.outputs>).filter((format) => Boolean(file.outputs[format]))
    }))
  };
}

export async function deleteJob(jobId: string): Promise<void> {
  const state = getJobState();
  const job = state.jobs.get(jobId);
  if (!job) {
    return;
  }

  state.jobs.delete(jobId);

  const relative = path.relative(TEMP_ROOT, job.rootDir);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Refusing to delete a directory outside the temporary job root.");
  }

  await rm(job.rootDir, { recursive: true, force: true });
}

export async function cleanupExpiredJobs(): Promise<void> {
  const state = getJobState();
  const now = Date.now();
  const expired = [...state.jobs.values()].filter((job) => now > job.expiresAt.getTime());
  await Promise.all(expired.map((job) => deleteJob(job.id).catch(() => undefined)));
}

function scheduleCleanup(): void {
  const state = getJobState();
  if (state.cleanupTimer) {
    return;
  }

  state.cleanupTimer = setInterval(() => {
    void cleanupExpiredJobs();
  }, Math.min(getJobTtlMs(), 15 * 60 * 1000));
  state.cleanupTimer.unref?.();
}

function recalculateJobProgress(job: InternalConversionJob): void {
  if (!job.files.length) {
    job.progress = job.status === "completed" ? 100 : 0;
    return;
  }

  job.progress = Math.round(job.files.reduce((sum, file) => sum + file.progress, 0) / job.files.length);
}

function requireJob(jobId: string): InternalConversionJob {
  const job = getJobState().jobs.get(jobId);
  if (!job) {
    throw new Error(`Job "${jobId}" was not found.`);
  }

  return job;
}
