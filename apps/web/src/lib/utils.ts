import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fileSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "mind-map";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadText(filename: string, content: string, type: string) {
  downloadBlob(new Blob([content], { type }), filename);
}

export async function downloadPng(svg: string, filename: string) {
  const source = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The image could not be prepared."));
      image.src = source;
    });
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, image.width) * scale;
    canvas.height = Math.max(1, image.height) * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not export a PNG.");
    context.scale(scale, scale);
    context.drawImage(image, 0, 0);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) throw new Error("This browser could not export a PNG.");
    downloadBlob(png, filename);
  } finally {
    URL.revokeObjectURL(source);
  }
}
