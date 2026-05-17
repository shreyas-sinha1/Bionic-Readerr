import path from "node:path";
import { mkdir } from "node:fs/promises";
import { getJob, updateFile, updateJob } from "@/src/server/jobs/store";
import { assertPathInside } from "@/src/server/security/fileValidation";
import type { InternalConversionJob, InternalFileJob } from "@/src/server/jobs/types";
import type { OutputFormat } from "@/src/types/conversion";

const activeJobs = new Set<string>();

export function enqueueJob(jobId: string): void {
  if (activeJobs.has(jobId)) {
    return;
  }

  activeJobs.add(jobId);
  setImmediate(() => {
    void processJob(jobId).finally(() => {
      activeJobs.delete(jobId);
    });
  });
}

export async function processJob(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) {
    return;
  }

  updateJob(jobId, {
    status: "processing",
    progress: 1
  });

  let completed = 0;
  let failed = 0;

  for (const file of job.files) {
    try {
      await processFile(job, file);
      completed += 1;
    } catch (error) {
      failed += 1;
      updateFile(job.id, file.id, {
        status: "error",
        progress: 100,
        message: "Conversion failed",
        error: error instanceof Error ? error.message : "Unknown conversion error"
      });
    }
  }

  updateJob(jobId, {
    status: completed > 0 ? "completed" : "error",
    progress: 100,
    error: failed > 0 ? `${failed} file${failed === 1 ? "" : "s"} failed to convert.` : undefined
  });
}

async function processFile(job: InternalConversionJob, file: InternalFileJob): Promise<void> {
  updateFile(job.id, file.id, {
    status: "processing",
    progress: 10,
    message: "Extracting readable text"
  });

  const { parseSourceDocument } = await import("@/src/server/parsers");
  const parsed = await parseSourceDocument(file.inputPath, file.extension, file.originalName);

  updateFile(job.id, file.id, {
    progress: 38,
    message: "Applying Bionic Reading fixation"
  });

  const [{ bionicizeHtmlFragment, normalizeBionicOptions }, { writeHtmlOutput }] = await Promise.all([
    import("@/src/bionic/engine"),
    import("@/src/server/exporters/html")
  ]);
  const options = normalizeBionicOptions(job.options);
  const convertedHtml = bionicizeHtmlFragment(parsed.html, options);
  const outputBase = path.join(job.outputDir, `${file.id}-${stripExtension(file.safeName)}`);
  await mkdir(path.dirname(outputBase), { recursive: true });

  const outputs: Partial<Record<OutputFormat, string>> = {};

  const htmlPath = `${outputBase}.html`;
  assertPathInside(job.outputDir, htmlPath);
  await writeHtmlOutput(htmlPath, convertedHtml, {
    title: parsed.title,
    sourceName: file.originalName
  });
  outputs.html = htmlPath;

  updateFile(job.id, file.id, {
    progress: 55,
    message: "Preparing text export",
    outputs
  });

  const { writeTxtOutput } = await import("@/src/server/exporters/txt");
  const txtPath = `${outputBase}.txt`;
  assertPathInside(job.outputDir, txtPath);
  await writeTxtOutput(txtPath, parsed.text, options);
  outputs.txt = txtPath;

  updateFile(job.id, file.id, {
    progress: 68,
    message: "Rendering PDF",
    outputs
  });

  try {
    const { writePdfOutput } = await import("@/src/server/exporters/pdf");
    const pdfPath = `${outputBase}.pdf`;
    assertPathInside(job.outputDir, pdfPath);
    await writePdfOutput(pdfPath, convertedHtml, parsed.title, file.originalName);
    outputs.pdf = pdfPath;
  } catch (error) {
    file.warnings.push(error instanceof Error ? error.message : "PDF export failed.");
  }

  updateFile(job.id, file.id, {
    progress: 86,
    message: "Building DOCX",
    outputs
  });

  try {
    const { writeDocxOutput } = await import("@/src/server/exporters/docx");
    const docxPath = `${outputBase}.docx`;
    assertPathInside(job.outputDir, docxPath);
    await writeDocxOutput(docxPath, convertedHtml, parsed.title, file.originalName);
    outputs.docx = docxPath;
  } catch (error) {
    file.warnings.push(error instanceof Error ? error.message : "DOCX export failed.");
  }

  updateFile(job.id, file.id, {
    status: "completed",
    progress: 100,
    message: "Ready to download",
    outputs,
    warnings: [...parsed.warnings, ...file.warnings].filter(Boolean)
  });
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}
