"use client";

import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  Download,
  FileArchive,
  FileText,
  Loader2,
  Moon,
  RefreshCw,
  Sun,
  Trash2,
  UploadCloud
} from "lucide-react";
import type { Intensity, OutputFormat, PublicConversionJob, PublicFileJob } from "@/src/types/conversion";

const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".docx", ".md", ".epub", ".rtf"];
const FORMAT_LABELS: Record<OutputFormat, string> = {
  pdf: "PDF",
  docx: "DOCX",
  html: "HTML",
  txt: "TXT"
};

const INTENSITY_COPY: Record<Intensity, string> = {
  weak: "Subtle fixation for dense or technical text.",
  medium: "Balanced fixation for everyday reading.",
  strong: "Heavier fixation for fast scanning."
};

export function BionicApp() {
  const pollRef = useRef<number | undefined>(undefined);
  const [isDark, setIsDark] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [job, setJob] = useState<PublicConversionJob | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [intensity, setIntensity] = useState<Intensity>("medium");
  const [format, setFormat] = useState<OutputFormat>("pdf");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedFile = useMemo(() => {
    if (!job?.files.length) {
      return null;
    }

    return job.files.find((file) => file.id === selectedFileId) ?? job.files[0];
  }, [job, selectedFileId]);

  useEffect(() => {
    const saved = window.localStorage.getItem("br-theme");
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setIsDark(saved ? saved === "dark" : prefersDark);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    window.localStorage.setItem("br-theme", isDark ? "dark" : "light");
  }, [isDark]);

  useEffect(() => {
    if (!selectedFile || selectedFile.status !== "completed" || !job) {
      setPreviewHtml("");
      return;
    }

    let cancelled = false;
    fetch(`/api/jobs/${job.id}/preview?fileId=${selectedFile.id}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Preview is not ready yet.");
        }
        return response.text();
      })
      .then((html) => {
        if (!cancelled) {
          setPreviewHtml(html);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewHtml("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [job, selectedFile]);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, []);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const nextFiles = Array.from(incoming).filter((file) =>
      ACCEPTED_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension))
    );

    setFiles((current) => {
      const keySet = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      const unique = nextFiles.filter((file) => !keySet.has(`${file.name}:${file.size}:${file.lastModified}`));
      return [...current, ...unique];
    });
    setNotice(nextFiles.length ? null : "Choose PDF, TXT, DOCX, Markdown, EPUB, or RTF files.");
    setError(null);
  }, []);

  const removeQueuedFile = (index: number) => {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const resetWorkflow = () => {
    setFiles([]);
    setJob(null);
    setSelectedFileId(null);
    setPreviewHtml("");
    setUploadProgress(0);
    setNotice(null);
    setError(null);
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
    }
  };

  const startPolling = (jobId: string) => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
    }

    pollRef.current = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        if (!response.ok) {
          throw new Error("The conversion job is no longer available.");
        }

        const nextJob = (await response.json()) as PublicConversionJob;
        setJob(nextJob);
        const firstCompleted = nextJob.files.find((file) => file.status === "completed");
        setSelectedFileId((current) => current ?? firstCompleted?.id ?? nextJob.files[0]?.id ?? null);

        if (nextJob.status === "completed" || nextJob.status === "error") {
          window.clearInterval(pollRef.current);
        }
      } catch (pollError) {
        window.clearInterval(pollRef.current);
        setError(pollError instanceof Error ? pollError.message : "Unable to refresh conversion status.");
      }
    }, 900);
  };

  const upload = async () => {
    if (!files.length || isUploading) {
      return;
    }

    setIsUploading(true);
    setError(null);
    setNotice(null);
    setJob(null);
    setSelectedFileId(null);
    setPreviewHtml("");
    setUploadProgress(0);

    const form = new FormData();
    form.append("intensity", intensity);
    for (const file of files) {
      form.append("files", file, file.name);
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/jobs");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      setIsUploading(false);
      if (xhr.status < 200 || xhr.status >= 300) {
        try {
          const payload = JSON.parse(xhr.responseText) as { error?: string };
          setError(payload.error ?? "Upload failed.");
        } catch {
          setError("Upload failed.");
        }
        return;
      }

      const nextJob = JSON.parse(xhr.responseText) as PublicConversionJob;
      setJob(nextJob);
      setSelectedFileId(nextJob.files[0]?.id ?? null);
      startPolling(nextJob.id);
      setNotice("Upload complete. Conversion is running server-side.");
    };
    xhr.onerror = () => {
      setIsUploading(false);
      setError("Network error while uploading files.");
    };
    xhr.send(form);
  };

  const downloadUrl = (file: PublicFileJob, requestedFormat: OutputFormat) => {
    if (!job) {
      return "#";
    }

    return `/api/jobs/${job.id}/download?fileId=${file.id}&format=${requestedFormat}`;
  };

  const downloadAllUrl = () => {
    if (!job) {
      return "#";
    }

    return `/api/jobs/${job.id}/download-all?format=${format}`;
  };

  const copySelected = async () => {
    if (!job || !selectedFile || selectedFile.status !== "completed") {
      return;
    }

    try {
      const txtResponse = await fetch(downloadUrl(selectedFile, "txt"));
      const text = await txtResponse.text();

      if ("ClipboardItem" in window && previewHtml) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([previewHtml], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" })
          })
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }

      setNotice("Copied the converted document to your clipboard.");
    } catch {
      setError("Clipboard copy failed. Try downloading the file instead.");
    }
  };

  const queuedBytes = files.reduce((sum, file) => sum + file.size, 0);
  const currentProgress = isUploading ? uploadProgress : job?.progress ?? 0;
  const canDownloadSelected = Boolean(selectedFile?.availableFormats.includes(format));
  const hasBatchFormat = Boolean(job?.files.some((file) => file.availableFormats.includes(format)));
  const preventUnavailable = (available: boolean) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!available) {
      event.preventDefault();
    }
  };

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Application controls">
        <div>
          <p className="eyebrow">Server-side document conversion</p>
          <h1>Bionic Reader Converter</h1>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" type="button" onClick={resetWorkflow} title="Reset workflow">
            <RefreshCw aria-hidden="true" />
          </button>
          <button className="icon-button" type="button" onClick={() => setIsDark((value) => !value)} title="Toggle theme">
            {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </button>
        </div>
      </section>

      <section className="workspace">
        <div className="control-panel">
          <label
            className={`dropzone ${isDragging ? "is-dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              addFiles(event.dataTransfer.files);
            }}
          >
            <input
              type="file"
              multiple
              accept={ACCEPTED_EXTENSIONS.join(",")}
              onChange={(event) => {
                if (event.target.files) {
                  addFiles(event.target.files);
                }
              }}
            />
            <UploadCloud aria-hidden="true" />
            <span>Drop files here or browse</span>
            <small>PDF, TXT, DOCX, Markdown, EPUB, and RTF</small>
          </label>

          <div className="settings-block">
            <div className="setting-heading">
              <span>Bionic strength</span>
              <strong>{intensity}</strong>
            </div>
            <input
              className="strength-slider"
              aria-label="Bionic strength"
              type="range"
              min={0}
              max={2}
              step={1}
              value={["weak", "medium", "strong"].indexOf(intensity)}
              onChange={(event) => setIntensity((["weak", "medium", "strong"] as Intensity[])[Number(event.target.value)])}
            />
            <div className="strength-labels" aria-hidden="true">
              <span>Weak</span>
              <span>Medium</span>
              <span>Strong</span>
            </div>
            <p className="setting-hint">{INTENSITY_COPY[intensity]}</p>
          </div>

          <div className="settings-block">
            <div className="setting-heading">
              <span>Output format</span>
              <strong>{FORMAT_LABELS[format]}</strong>
            </div>
            <div className="segmented-control" role="radiogroup" aria-label="Output format">
              {(["pdf", "docx", "html", "txt"] as OutputFormat[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={format === item ? "active" : ""}
                  onClick={() => setFormat(item)}
                  role="radio"
                  aria-checked={format === item}
                >
                  {FORMAT_LABELS[item]}
                </button>
              ))}
            </div>
          </div>

          <button className="primary-action" type="button" onClick={upload} disabled={!files.length || isUploading}>
            {isUploading ? <Loader2 className="spin" aria-hidden="true" /> : <UploadCloud aria-hidden="true" />}
            Convert files
          </button>

          <div className="progress-wrap" aria-label="Progress">
            <div className="progress-meta">
              <span>{isUploading ? "Uploading" : job?.status ?? "Waiting"}</span>
              <strong>{currentProgress}%</strong>
            </div>
            <div className="progress-bar">
              <span style={{ width: `${currentProgress}%` }} />
            </div>
          </div>

          {error ? <p className="message error">{error}</p> : null}
          {notice ? <p className="message">{notice}</p> : null}

          <div className="file-list" aria-label="Selected files">
            <div className="file-list-heading">
              <span>Files</span>
              <small>{files.length ? `${files.length} selected · ${formatBytes(queuedBytes)}` : "No files selected"}</small>
            </div>

            {job?.files.length
              ? job.files.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    className={`file-row ${selectedFile?.id === file.id ? "selected" : ""}`}
                    onClick={() => setSelectedFileId(file.id)}
                  >
                    <FileText aria-hidden="true" />
                    <span>
                      <strong>{file.originalName}</strong>
                      <small>{file.message}</small>
                    </span>
                    {file.status === "completed" ? <CheckCircle2 className="status-ok" aria-hidden="true" /> : null}
                    {file.status === "processing" ? <Loader2 className="spin" aria-hidden="true" /> : null}
                  </button>
                ))
              : files.map((file, index) => (
                  <div className="file-row queued" key={`${file.name}-${file.lastModified}`}>
                    <FileText aria-hidden="true" />
                    <span>
                      <strong>{file.name}</strong>
                      <small>{formatBytes(file.size)}</small>
                    </span>
                    <button className="small-icon" type="button" onClick={() => removeQueuedFile(index)} title="Remove file">
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>
                ))}
          </div>
        </div>

        <div className="preview-panel">
          <div className="preview-toolbar">
            <div>
              <p className="eyebrow">Instant preview</p>
              <h2>{selectedFile?.originalName ?? "Converted document"}</h2>
            </div>
            <div className="download-actions">
              <button
                className="secondary-action"
                type="button"
                onClick={copySelected}
                disabled={!selectedFile || selectedFile.status !== "completed"}
                title="Copy converted text"
              >
                <Clipboard aria-hidden="true" />
                Copy
              </button>
              <a
                className={`secondary-action ${canDownloadSelected ? "" : "disabled"}`}
                href={selectedFile && canDownloadSelected ? downloadUrl(selectedFile, format) : "#"}
                aria-disabled={!canDownloadSelected}
                onClick={preventUnavailable(canDownloadSelected)}
              >
                <Download aria-hidden="true" />
                Download
              </a>
              <a
                className={`secondary-action ${hasBatchFormat ? "" : "disabled"}`}
                href={hasBatchFormat ? downloadAllUrl() : "#"}
                aria-disabled={!hasBatchFormat}
                onClick={preventUnavailable(hasBatchFormat)}
              >
                <FileArchive aria-hidden="true" />
                Batch ZIP
              </a>
            </div>
          </div>

          {selectedFile?.warnings.length ? (
            <div className="warning-list">
              {selectedFile.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          <div className="preview-frame-wrap">
            {previewHtml ? (
              <iframe title="Converted file preview" sandbox="" srcDoc={previewHtml} />
            ) : (
              <div className="empty-preview">
                <FileText aria-hidden="true" />
                <span>{job ? "Preview will appear when conversion finishes." : "Upload a document to see the converted reading view."}</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}
