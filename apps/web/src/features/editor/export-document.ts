"use client";

import { toOutline, toSvg } from "@arbour/mindmap-core";

import { downloadPng, downloadText, fileSlug } from "@/lib/utils";
import { useEditor } from "@/features/editor/store";

export type ExportFormat = "json" | "outline" | "svg" | "png";

export async function exportActiveDocument(format: ExportFormat) {
  const state = useEditor.getState();
  const document = state.documents.find((item) => item.id === state.activeId);
  if (!document) return;
  const slug = fileSlug(document.title);
  if (format === "json") {
    downloadText(`${slug}.json`, JSON.stringify(document, null, 2), "application/json");
    return;
  }
  if (format === "outline") {
    downloadText(`${slug}.txt`, toOutline(document), "text/plain");
    return;
  }
  if (format === "svg") {
    downloadText(`${slug}.svg`, toSvg(document), "image/svg+xml");
    return;
  }
  try {
    await downloadPng(toSvg(document), `${slug}.png`);
  } catch {
    state.showBanner("The PNG export failed.");
  }
}
