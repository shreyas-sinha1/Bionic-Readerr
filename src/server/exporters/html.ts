import { writeFile } from "node:fs/promises";

export interface HtmlDocumentMeta {
  title: string;
  sourceName: string;
  generatedAt?: Date;
}

export function buildStandaloneHtml(contentHtml: string, meta: HtmlDocumentMeta): string {
  const title = escapeHtml(meta.title || meta.sourceName || "Bionic Reader Document");
  const generatedAt = (meta.generatedAt ?? new Date()).toISOString();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="generator" content="Bionic Reader Converter" />
  <meta name="generated-at" content="${generatedAt}" />
  <title>${title}</title>
  <style>${documentCss()}</style>
</head>
<body>
  <main class="br-document" data-source="${escapeHtml(meta.sourceName)}">
    ${contentHtml}
  </main>
</body>
</html>`;
}

export async function writeHtmlOutput(filePath: string, contentHtml: string, meta: HtmlDocumentMeta): Promise<void> {
  await writeFile(filePath, buildStandaloneHtml(contentHtml, meta), "utf8");
}

export function documentCss(): string {
  return `
:root {
  color-scheme: light;
  --br-text: #18181b;
  --br-muted: #5f646d;
  --br-page: #ffffff;
  --br-border: #d9dde4;
  --br-fixation: #050505;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
  background: #f5f6f8;
  color: var(--br-text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.58;
}

body {
  padding: 28px;
}

.br-document {
  max-width: 980px;
  margin: 0 auto;
  background: var(--br-page);
  border: 1px solid var(--br-border);
  border-radius: 8px;
  padding: 40px;
}

.br-fixation {
  color: var(--br-fixation);
  font-weight: 800;
}

.br-plain-text {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: inherit;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  line-height: 1.18;
  margin: 1.45em 0 0.55em;
}

h1:first-child,
h2:first-child,
h3:first-child {
  margin-top: 0;
}

p,
ul,
ol,
blockquote,
table,
pre {
  margin: 0 0 1em;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  border: 1px solid #cfd5df;
  padding: 0.45rem 0.55rem;
  vertical-align: top;
}

blockquote {
  border-left: 4px solid #7a8a99;
  color: #3f4650;
  padding-left: 1rem;
}

.pdf-pages {
  display: grid;
  gap: 24px;
  justify-content: center;
}

.pdf-page {
  position: relative;
  overflow: hidden;
  background: #fff;
  border: 1px solid #d7dce4;
  box-shadow: 0 8px 26px rgba(0, 0, 0, 0.10);
  page-break-after: always;
}

.pdf-text {
  position: absolute;
  display: block;
  white-space: pre;
  overflow: visible;
  line-height: 1;
  transform-origin: left top;
  font-family: Arial, Helvetica, sans-serif;
  color: #111;
}

@media print {
  body {
    padding: 0;
    background: #fff;
  }

  .br-document {
    max-width: none;
    border: 0;
    border-radius: 0;
    padding: 0.45in;
  }

  .br-document:has(.pdf-pages) {
    padding: 0;
  }

  .pdf-pages {
    gap: 0;
  }

  .pdf-page {
    border: 0;
    box-shadow: none;
  }
}
`.trim();
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
