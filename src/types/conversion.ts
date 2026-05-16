export type AcceptedExtension = "pdf" | "txt" | "docx" | "md" | "epub" | "rtf";

export type Intensity = "weak" | "medium" | "strong";

export type OutputFormat = "pdf" | "docx" | "html" | "txt";

export type JobStatus = "queued" | "uploading" | "processing" | "completed" | "error" | "expired";

export type FileStatus = "queued" | "processing" | "completed" | "error";

export interface BionicOptions {
  intensity: Intensity;
  fixationPercent?: number;
  minWordLength?: number;
}

export interface ParsedDocument {
  title: string;
  sourceType: AcceptedExtension;
  html: string;
  text: string;
  pageCount?: number;
  warnings: string[];
}

export interface PublicFileJob {
  id: string;
  originalName: string;
  extension: AcceptedExtension;
  sizeBytes: number;
  status: FileStatus;
  progress: number;
  message: string;
  warnings: string[];
  availableFormats: OutputFormat[];
  error?: string;
}

export interface PublicConversionJob {
  id: string;
  status: JobStatus;
  progress: number;
  createdAt: string;
  expiresAt: string;
  files: PublicFileJob[];
  error?: string;
}
