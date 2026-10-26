"use client";

import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

let workerReady = false;

function ensureWorker() {
  if (workerReady) return;
  // Served from apps/web/public so import works offline and avoids CDN 404s.
  GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  workerReady = true;
}

/** Extract plain text from a PDF in the browser for mind-map import. */
export async function extractTextFromPdf(file: File): Promise<string> {
  ensureWorker();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const pages: string[] = [];
  const limit = Math.min(pdf.numPages, 40);
  for (let pageNumber = 1; pageNumber <= limit; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) pages.push(line);
  }
  return pages.join("\n\n").trim();
}
