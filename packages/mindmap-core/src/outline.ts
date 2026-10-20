import { childrenOf } from "./document";
import type { MindMapDocument } from "./types";
import { MAX_TEXT } from "./types";

export interface OutlineLine {
  depth: number;
  text: string;
}

export function parseOutline(outline: string): OutlineLine[] {
  const parsed: OutlineLine[] = [];
  for (const line of outline.replace(/\r\n/g, "\n").split("\n")) {
    if (!line.trim()) continue;
    const match = /^(\s*)(?:[-*•]\s+)?(.*)$/.exec(line);
    const indent = match?.[1] ?? "";
    const text = (match?.[2] ?? "").trim();
    if (!text) continue;
    const depth = indent.includes("\t")
      ? indent.split("\t").length - 1
      : Math.floor(indent.length / 2);
    parsed.push({ depth, text: Array.from(text).slice(0, MAX_TEXT).join("") });
  }
  if (!parsed.length) return [];
  const min = Math.min(...parsed.map((line) => line.depth));
  return parsed.map((line) => ({ depth: line.depth - min, text: line.text }));
}

export function toOutline(doc: MindMapDocument): string {
  const lines: string[] = [];
  const walk = (id: string, depth: number) => {
    const node = doc.nodes[id];
    if (!node) return;
    lines.push(`${"  ".repeat(depth)}${node.text}`);
    for (const child of childrenOf(doc, id)) walk(child.id, depth + 1);
  };
  walk(doc.rootId, 0);
  const floating = Object.values(doc.nodes)
    .filter((node) => node.floating && !node.parentId)
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  for (const node of floating) {
    lines.push("");
    walk(node.id, 0);
  }
  return lines.join("\n").trim();
}
