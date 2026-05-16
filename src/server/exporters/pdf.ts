import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";
import { buildStandaloneHtml } from "@/src/server/exporters/html";

export async function writePdfOutput(filePath: string, contentHtml: string, title: string, sourceName: string): Promise<void> {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 1 });
    await page.setContent(buildStandaloneHtml(contentHtml, { title, sourceName }), {
      waitUntil: ["load", "networkidle0"],
      timeout: 120_000
    });
    await page.emulateMediaType("print");
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      format: "A4",
      margin: {
        top: "0.35in",
        right: "0.35in",
        bottom: "0.35in",
        left: "0.35in"
      },
      timeout: 120_000
    });
    await writeFile(filePath, pdf);
    await page.close();
  } finally {
    await browser.close();
  }
}

async function launchBrowser(): Promise<Browser> {
  const executablePath = await resolveChromiumPath();

  return puppeteer.launch({
    executablePath,
    args: [
      ...chromium.args,
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
      "--no-sandbox"
    ],
    defaultViewport: { width: 1440, height: 1200 },
    headless: true
  });
}

async function resolveChromiumPath(): Promise<string> {
  if (process.env.CHROME_EXECUTABLE_PATH && existsSync(process.env.CHROME_EXECUTABLE_PATH)) {
    return process.env.CHROME_EXECUTABLE_PATH;
  }

  const localPath = getCommonLocalBrowserPath();
  if (localPath) {
    return localPath;
  }

  try {
    const path = await chromium.executablePath();
    if (path && existsSync(path)) {
      return path;
    }
  } catch {
    // Fall through to the actionable error below.
  }

  throw new Error(
    "No Chromium executable was found. Set CHROME_EXECUTABLE_PATH, install Chrome/Edge locally, or use the Docker image."
  );
}

function getCommonLocalBrowserPath(): string | undefined {
  const platform = os.platform();
  const candidates =
    platform === "win32"
      ? [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
          "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
        ]
      : platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Chromium.app/Contents/MacOS/Chromium"
          ]
        : ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"];

  return candidates.find((candidate) => existsSync(candidate));
}
