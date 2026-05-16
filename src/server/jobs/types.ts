import type { AcceptedExtension, BionicOptions, FileStatus, JobStatus, OutputFormat, PublicConversionJob } from "@/src/types/conversion";

export interface InternalFileJob {
  id: string;
  originalName: string;
  safeName: string;
  extension: AcceptedExtension;
  mimeType: string;
  sizeBytes: number;
  inputPath: string;
  status: FileStatus;
  progress: number;
  message: string;
  warnings: string[];
  outputs: Partial<Record<OutputFormat, string>>;
  error?: string;
}

export interface InternalConversionJob {
  id: string;
  status: JobStatus;
  progress: number;
  createdAt: Date;
  expiresAt: Date;
  rootDir: string;
  inputDir: string;
  outputDir: string;
  options: BionicOptions;
  files: InternalFileJob[];
  error?: string;
}

export interface SerializedJob extends PublicConversionJob {}
