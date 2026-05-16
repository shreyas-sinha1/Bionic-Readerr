# Bionic Reader Converter

A production-ready Next.js application for converting readable text from PDFs and text-based documents into Bionic Reading format, then exporting the result as PDF, DOCX, HTML, or TXT.

The converter preserves document order, paragraph structure, punctuation, spacing, headings, lists, tables, and supported inline styles as closely as each source format allows. PDF files are reconstructed from text coordinates, so native text PDFs preserve visual page layout far better than scanned image PDFs.

## Project Structure

```text
app/
  globals.css                 Global responsive UI styles and themes
  layout.tsx                  App metadata and root layout
  page.tsx                    Main route
components/
  BionicApp.tsx               Drag/drop UI, polling, preview, download actions
pages/api/
  health.ts                   Health check
  jobs/index.ts               Streaming multipart upload endpoint
  jobs/[jobId]/index.ts       Job status polling
  jobs/[jobId]/preview.ts     Converted HTML preview
  jobs/[jobId]/download.ts    Single converted file download
  jobs/[jobId]/download-all.ts Batch ZIP download
src/bionic/
  engine.ts                   Unicode-aware Bionic Reading algorithm
src/server/
  exporters/                  HTML, TXT, DOCX, PDF exporters
  jobs/                       Temporary job store and conversion queue
  parsers/                    PDF, TXT, DOCX, MD, EPUB, RTF parsers
  security/                   File validation and temporary path safety
src/types/
  conversion.ts               Shared frontend/backend types
  vendor.d.ts                 Declarations for parser/export packages
tests/
  bionic.test.ts              Core algorithm tests
```

## Architecture Decisions

- **Next.js + API routes** keep frontend and server-side processing deployable as one app.
- **Streaming uploads with Busboy** avoid buffering large files in the UI or request body parser.
- **Temporary job directories** are created under the OS temp folder and automatically cleaned after `JOB_TTL_MS`.
- **Parser/exporter modules** keep each file format isolated and maintainable.
- **HTML as the internal layout format** lets the app preserve headings, lists, tables, inline styles, and PDF text positioning before exporting to PDF/DOCX/HTML/TXT.
- **Unicode-aware word segmentation** uses `Intl.Segmenter` when available, preserving punctuation, capitalization, whitespace, and multilingual text boundaries.
- **Headless Chromium PDF rendering** produces a real downloadable Bionic Reading PDF after conversion.

## Local Setup

1. Install Node.js 20.11 or newer.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Optional: copy environment defaults:

   ```bash
   cp .env.example .env.local
   ```

4. If PDF export cannot find Chrome/Edge automatically, set `CHROME_EXECUTABLE_PATH` in `.env.local`.

   Windows example:

   ```text
   CHROME_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000`.

## Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `CHROME_EXECUTABLE_PATH` | No | auto-detect | Local Chromium/Chrome/Edge path for PDF export. Docker sets this to `/usr/bin/chromium`. |
| `MAX_UPLOAD_BYTES` | No | `262144000` | Max size for a single uploaded file. |
| `MAX_BATCH_FILES` | No | `12` | Max files in one batch. |
| `JOB_TTL_MS` | No | `3600000` | Temporary job/output retention period. |
| `NEXT_STANDALONE` | No | unset | Set `true` when building Docker standalone output. |

## Deployment

### Docker

Docker is the recommended deployment target for files over 100 MB because it avoids serverless body and runtime limits.

```bash
docker build -t bionic-reader-converter .
docker run --rm -p 3000:3000 --env-file .env.example bionic-reader-converter
```

Then open `http://localhost:3000`.

### Vercel

1. Push the repository to GitHub.
2. Import the project in Vercel.
3. Set environment variables from `.env.example` as needed.
4. Keep uploads within your Vercel plan limits.

For large PDF workflows, use Docker or pair the app with direct-to-object-storage uploads and a background worker.

### Netlify

1. Connect the repository in Netlify.
2. Use the Next.js runtime/plugin.
3. Set build command to `npm run build`.
4. Set publish directory to `.next`.
5. Configure environment variables.

Like Vercel, Netlify function limits may constrain very large files. Docker is the safer deployment path for heavy conversion jobs.

## Performance Optimizations

- Uploads stream directly to temporary files.
- Heavy parsing libraries are imported server-side only.
- UI progress separates upload progress from conversion progress.
- Batch jobs process files sequentially to avoid exhausting memory on large PDFs.
- PDF/DOCX failures are reported as warnings when HTML/TXT outputs are still available.
- Output files are generated once per job and streamed on download.

## Format Notes

- **PDF:** Preserves native text order and page coordinates. Scanned PDFs need OCR before upload.
- **DOCX:** Uses Mammoth for structural HTML conversion, preserving headings, lists, tables, and common inline styles.
- **Markdown:** Renders GFM Markdown to HTML before conversion.
- **EPUB:** Reads the OPF spine order and converts XHTML chapter bodies.
- **RTF:** Converts to HTML server-side before applying the Bionic algorithm.
- **TXT:** Plain text cannot carry real bold styling. TXT output uses Unicode mathematical bold characters for Latin letters/digits in the fixation portion without adding marker characters.

## Testing Checklist

Run automated checks:

```bash
npm run typecheck
npm run test
npm run build
```

Manual QA:

- Upload one file of each supported type.
- Upload a batch with mixed formats.
- Verify weak, medium, and strong strength settings change fixation density.
- Confirm punctuation, spacing, line breaks, and document order are preserved.
- Preview a converted file and copy it to the clipboard.
- Download PDF, DOCX, HTML, and TXT outputs.
- Download a batch ZIP.
- Test dark and light modes.
- Test mobile width below 680 px.
- Upload an unsupported file and confirm a clear validation error.
- Upload a PDF containing scanned image-only pages and confirm the warning is shown.
- Confirm temporary files disappear after `JOB_TTL_MS`.

## Suggested Future Improvements

- Optional OCR pipeline for scanned PDFs.
- Dedicated worker service and persistent job queue for multi-user high-volume deployments.
- Direct-to-object-storage uploads for serverless large-file support.
- Per-language fixation tuning.
- User-selectable TXT export style.
- Side-by-side original vs converted diff preview.
- Authentication, rate limiting, and organization-level conversion history.
