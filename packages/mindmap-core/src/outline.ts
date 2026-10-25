import { childrenOf } from "./document";
import type { MindMapDocument } from "./types";
import { MAX_TEXT } from "./types";

export interface OutlineLine {
  depth: number;
  text: string;
}

/**
 * Parse indented outlines and common Markdown exports (Whimsical paste-special,
 * heading trees, bulleted/numbered lists) into a depth/text hierarchy.
 */
export function parseOutline(outline: string): OutlineLine[] {
  const parsed: OutlineLine[] = [];
  let listBaseDepth = 0;
  let inFence = false;

  for (const raw of outline.replace(/\r\n/g, "\n").split("\n")) {
    const trimmed = raw.trim();
    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (!trimmed) continue;
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) continue;

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const depth = heading[1].length - 1;
      const text = stripInlineMarkdown(heading[2]);
      if (!text) continue;
      listBaseDepth = depth + 1;
      parsed.push({ depth, text: clipText(text) });
      continue;
    }

    const list = /^(\s*)(?:[-*•+]|\d+[.)])\s+(.*)$/.exec(raw);
    if (list) {
      const indentDepth = indentLevel(list[1]);
      const text = stripInlineMarkdown(list[2]);
      if (!text) continue;
      parsed.push({ depth: listBaseDepth + indentDepth, text: clipText(text) });
      continue;
    }

    // Whimsical mind-map paste-special: plain indented lines, no markers.
    const plain = /^(\s*)(.*)$/.exec(raw);
    const text = stripInlineMarkdown(plain?.[2] ?? "");
    if (!text) continue;
    listBaseDepth = 0;
    parsed.push({ depth: indentLevel(plain?.[1] ?? ""), text: clipText(text) });
  }

  if (!parsed.length) return [];
  const min = Math.min(...parsed.map((line) => line.depth));
  return parsed.map((line) => ({ depth: Math.max(0, line.depth - min), text: line.text }));
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

function indentLevel(indent: string): number {
  if (!indent) return 0;
  if (indent.includes("\t")) return indent.split("\t").length - 1;
  // Two spaces (or one tab) = one hierarchy step. Four-space Markdown nests
  // still work because depths may skip (0, 2, 4) while parent stacking stays valid.
  const spaces = indent.replace(/\t/g, "  ").length;
  return Math.floor(spaces / 2);
}

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s+/, "")
    .trim();
}

function clipText(value: string): string {
  return Array.from(value).slice(0, MAX_TEXT).join("");
}
