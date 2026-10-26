"use client";

import {
  documentFromDocumentText,
  documentFromOutline,
  parseDocument,
  type MindMapDocument,
} from "@arbour/mindmap-core";

import { extractTextFromPdf } from "@/features/editor/pdf-import";

export type SampleId =
  | "product-plan-pdf"
  | "product-plan-txt"
  | "hindi-outline"
  | "gujarati-outline"
  | "whimsical-md";

export const SAMPLE_OPTIONS: { id: SampleId; label: string; description: string; path: string }[] = [
  {
    id: "product-plan-pdf",
    label: "Sample PDF (English)",
    description: "Build a map from a text PDF",
    path: "/samples/document-product-plan.pdf",
  },
  {
    id: "product-plan-txt",
    label: "Sample text document",
    description: "Plain prose → mind map",
    path: "/samples/document-product-plan.txt",
  },
  {
    id: "hindi-outline",
    label: "Hindi outline",
    description: "Markdown outline in Hindi",
    path: "/samples/document-hindi-outline.md",
  },
  {
    id: "gujarati-outline",
    label: "Gujarati outline",
    description: "Markdown outline in Gujarati",
    path: "/samples/document-gujarati-outline.md",
  },
  {
    id: "whimsical-md",
    label: "Whimsical Markdown",
    description: "Whimsical-style outline import",
    path: "/samples/whimsical-product-ideas.md",
  },
];

export async function loadSampleDocument(id: SampleId): Promise<MindMapDocument> {
  const sample = SAMPLE_OPTIONS.find((item) => item.id === id);
  if (!sample) throw new Error("Unknown sample.");

  const response = await fetch(sample.path);
  if (!response.ok) {
    throw new Error(`Sample not found (${response.status}). Restart the Arbour app on this project and try again.`);
  }

  const name = sample.path.split("/").pop()?.replace(/\.[^.]+$/, "") || "Sample";

  if (id === "product-plan-pdf") {
    const blob = await response.blob();
    const file = new File([blob], `${name}.pdf`, { type: "application/pdf" });
    const text = await extractTextFromPdf(file);
    const doc = documentFromDocumentText(text, name);
    if (!doc) throw new Error("Could not build a map from the sample PDF.");
    return doc;
  }

  const text = await response.text();
  if (id === "product-plan-txt") {
    const doc = documentFromDocumentText(text, name);
    if (!doc) throw new Error("Could not build a map from the sample text.");
    return doc;
  }

  // JSON maps are not used for samples today; keep Markdown/outline path.
  if (/^\s*[{\[]/.test(text)) {
    const parsed = parseDocument(JSON.parse(text) as unknown);
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed.document;
  }

  const doc = documentFromOutline(text, name) ?? documentFromDocumentText(text, name);
  if (!doc) throw new Error("Could not build a map from that sample.");
  return doc;
}
