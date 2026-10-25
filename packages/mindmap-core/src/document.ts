import { createNodeId, treeEdgeId } from "./ids";
import { sanitizeHref, sanitizeImageUrl } from "./security";
import { layoutDocument } from "./layout";
import {
  defaultEdgeStyle,
  defaultLayout,
  measureNode,
  repairTopicFill,
  rootStyle,
  styleForChild,
} from "./styles";
import {
  MAX_EMOJI,
  MAX_NODES,
  MAX_NOTE,
  MAX_TAG,
  MAX_TAGS,
  MAX_TEXT,
  type MindEdge,
  type MindMapDocument,
  type MindNode,
  type NodeId,
  type Point,
  type Side,
  type SubtreeSnapshot,
} from "./types";

export interface CreateDocumentInput {
  id?: string;
  title: string;
  rootText: string;
  now?: string;
  createId?: () => string;
}

export function createDocument(input: CreateDocumentInput): MindMapDocument {
  const createId = input.createId ?? createNodeId;
  const rootId = createId();
  const now = input.now ?? new Date().toISOString();
  const root = finalizeNode({
    id: rootId,
    parentId: null,
    text: clip(input.rootText || "Central topic", MAX_TEXT) || "Central topic",
    nodeType: "topic",
    side: "right",
    sortOrder: 0,
    collapsed: false,
    floating: false,
    position: { x: 0, y: 0 },
    width: 80,
    height: 44,
    style: rootStyle(),
    note: "",
    href: null,
    tags: [],
    emoji: "",
    imageUrl: null,
  });

  return {
    id: input.id ?? createId(),
    title: clip(input.title || "Untitled map", 120) || "Untitled map",
    schemaVersion: 1,
    rootId,
    nodes: { [rootId]: root },
    edges: {},
    layout: defaultLayout(),
    updatedAt: now,
  };
}

export function finalizeNode(node: MindNode): MindNode {
  const next: MindNode = {
    ...node,
    text: clip(node.text, MAX_TEXT),
    note: clip(node.note, MAX_NOTE),
    emoji: Array.from(node.emoji).slice(0, MAX_EMOJI).join(""),
    tags: node.tags
      .map((tag) => clip(tag.trim(), MAX_TAG))
      .filter(Boolean)
      .slice(0, MAX_TAGS),
    href: sanitizeHref(node.href),
    imageUrl: sanitizeImageUrl(node.imageUrl),
    style: repairTopicFill(node.style, node.nodeType),
  };
  const size = measureNode(next);
  next.width = size.width;
  next.height = size.height;
  return next;
}

export function childrenOf(doc: MindMapDocument, parentId: NodeId): MindNode[] {
  return Object.values(doc.nodes)
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function visibleChildren(doc: MindMapDocument, parentId: NodeId): MindNode[] {
  const parent = doc.nodes[parentId];
  if (!parent || parent.collapsed) return [];
  return childrenOf(doc, parentId);
}

export function isNodeVisible(doc: MindMapDocument, id: NodeId): boolean {
  let current = doc.nodes[id];
  if (!current) return false;
  const seen = new Set<string>();
  while (current.parentId) {
    if (seen.has(current.id)) return false;
    seen.add(current.id);
    const parent = doc.nodes[current.parentId];
    if (!parent) return false;
    if (parent.collapsed) return false;
    current = parent;
  }
  return true;
}

export function descendantIds(doc: MindMapDocument, id: NodeId): NodeId[] {
  const result: NodeId[] = [];
  const walk = (parentId: NodeId) => {
    for (const child of childrenOf(doc, parentId)) {
      result.push(child.id);
      walk(child.id);
    }
  };
  walk(id);
  return result;
}

export function subtreeIds(doc: MindMapDocument, id: NodeId): NodeId[] {
  return [id, ...descendantIds(doc, id)];
}

export function createsCycle(doc: MindMapDocument, nodeId: NodeId, parentId: NodeId): boolean {
  if (nodeId === parentId) return true;
  return descendantIds(doc, nodeId).includes(parentId);
}

export function hasCycle(doc: MindMapDocument): boolean {
  const children = new Map<string, string[]>();
  for (const node of Object.values(doc.nodes)) {
    if (!node.parentId) continue;
    const list = children.get(node.parentId);
    if (list) list.push(node.id);
    else children.set(node.parentId, [node.id]);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const walk = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const childId of children.get(id) ?? []) {
      if (walk(childId)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return Object.keys(doc.nodes).some((id) => walk(id));
}

export function nodeCenter(node: MindNode): Point {
  return {
    x: node.position.x + node.width / 2,
    y: node.position.y + node.height / 2,
  };
}

export function branchRootId(doc: MindMapDocument, id: NodeId): NodeId | null {
  let current = doc.nodes[id];
  if (!current || current.id === doc.rootId) return null;
  const seen = new Set<string>();
  while (current.parentId && current.parentId !== doc.rootId) {
    if (seen.has(current.id)) return null;
    seen.add(current.id);
    const parent = doc.nodes[current.parentId];
    if (!parent) return null;
    current = parent;
  }
  return current.id;
}

export function nextRootSide(doc: MindMapDocument): Side {
  let left = 0;
  let right = 0;
  for (const child of childrenOf(doc, doc.rootId)) {
    if (child.side === "left") left += 1;
    else right += 1;
  }
  return right <= left ? "right" : "left";
}

export function normalizeSiblings(doc: MindMapDocument, parentId: NodeId): void {
  childrenOf(doc, parentId).forEach((node, index) => {
    node.sortOrder = index;
  });
}

export function syncTreeEdges(doc: MindMapDocument): void {
  const keep = new Set<string>();
  for (const node of Object.values(doc.nodes)) {
    if (!node.parentId || node.floating || node.id === doc.rootId) continue;
    if (!doc.nodes[node.parentId]) continue;
    const id = treeEdgeId(node.id);
    keep.add(id);
    const existing = doc.edges[id];
    if (existing?.kind === "tree") {
      existing.sourceId = node.parentId;
      existing.targetId = node.id;
      if (existing.style.followNode) existing.style.stroke = node.style.borderColor;
      continue;
    }
    doc.edges[id] = {
      id,
      sourceId: node.parentId,
      targetId: node.id,
      kind: "tree",
      label: "",
      style: defaultEdgeStyle(node.style.borderColor, "tree"),
    };
  }

  for (const edge of Object.values(doc.edges)) {
    const source = doc.nodes[edge.sourceId];
    const target = doc.nodes[edge.targetId];
    if (!source || !target || edge.sourceId === edge.targetId) {
      delete doc.edges[edge.id];
      continue;
    }
    if (edge.kind === "tree" && !keep.has(edge.id)) delete doc.edges[edge.id];
  }
}

export function documentIssues(doc: MindMapDocument): string[] {
  const issues: string[] = [];
  const root = doc.nodes[doc.rootId];
  if (!root) {
    issues.push("The central topic is missing.");
    return issues;
  }
  if (root.parentId !== null || root.floating) {
    issues.push("The central topic has an invalid parent.");
  }
  if (Object.keys(doc.nodes).length > MAX_NODES) {
    issues.push(`A map can contain at most ${MAX_NODES} topics.`);
  }
  if (hasCycle(doc)) issues.push("The map contains a circular relationship.");

  const ids = new Set(Object.keys(doc.nodes));
  for (const node of Object.values(doc.nodes)) {
    if (node.id === doc.rootId) continue;
    if (!node.floating && !node.parentId) {
      issues.push(`Topic “${node.text}” is missing its parent.`);
    }
    if (node.parentId && !ids.has(node.parentId)) {
      issues.push(`Topic “${node.text}” points at a missing parent.`);
    }
    if (node.parentId === node.id) issues.push(`Topic “${node.text}” is its own parent.`);
    if (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) {
      issues.push(`Topic “${node.text}” has an invalid position.`);
    }
    if (node.width <= 0 || node.height <= 0) {
      issues.push(`Topic “${node.text}” has an invalid size.`);
    }
  }

  for (const edge of Object.values(doc.edges)) {
    if (!ids.has(edge.sourceId) || !ids.has(edge.targetId)) {
      issues.push("A connector points at a missing topic.");
    }
    if (edge.kind === "tree") {
      const target = doc.nodes[edge.targetId];
      if (!target || target.parentId !== edge.sourceId || edge.id !== treeEdgeId(target.id)) {
        issues.push("A branch connector does not match the topic hierarchy.");
      }
    }
  }

  for (const node of Object.values(doc.nodes)) {
    if (node.id === doc.rootId || node.floating || !node.parentId) continue;
    if (!doc.edges[treeEdgeId(node.id)]) {
      issues.push(`Topic “${node.text}” is missing its branch.`);
    }
  }

  return issues;
}

export function captureSubtree(doc: MindMapDocument, nodeId: NodeId): SubtreeSnapshot | null {
  const root = doc.nodes[nodeId];
  if (!root) return null;
  const ids = new Set(subtreeIds(doc, nodeId));
  const nodes = [...ids].map((id) => doc.nodes[id]).filter(Boolean);
  const edges = Object.values(doc.edges).filter(
    (edge) => ids.has(edge.sourceId) && ids.has(edge.targetId),
  );
  return {
    rootId: nodeId,
    nodes: structuredClone(nodes),
    edges: structuredClone(edges),
  };
}

export function findDropTarget(
  doc: MindMapDocument,
  draggedId: NodeId,
  point: Point,
): NodeId | null {
  const forbidden = new Set(subtreeIds(doc, draggedId));
  let best: { id: string; area: number } | null = null;
  for (const node of Object.values(doc.nodes)) {
    if (forbidden.has(node.id) || !isNodeVisible(doc, node.id)) continue;
    const { x, y } = node.position;
    const contains =
      point.x >= x && point.x <= x + node.width && point.y >= y && point.y <= y + node.height;
    if (!contains) continue;
    const area = node.width * node.height;
    if (!best || area < best.area) best = { id: node.id, area };
  }
  return best?.id ?? null;
}

export type ArrowDirection = "left" | "right" | "up" | "down";

export function nearestInDirection(
  doc: MindMapDocument,
  fromId: NodeId,
  direction: ArrowDirection,
): NodeId | null {
  const originNode = doc.nodes[fromId];
  if (!originNode) return null;
  const origin = nodeCenter(originNode);
  let best: { id: string; score: number } | null = null;

  for (const node of Object.values(doc.nodes)) {
    if (node.id === fromId || !isNodeVisible(doc, node.id)) continue;
    const center = nodeCenter(node);
    const dx = center.x - origin.x;
    const dy = center.y - origin.y;
    let primary = 0;
    let secondary = 0;
    if (direction === "right") {
      if (dx < 8) continue;
      primary = dx;
      secondary = Math.abs(dy);
    } else if (direction === "left") {
      if (dx > -8) continue;
      primary = -dx;
      secondary = Math.abs(dy);
    } else if (direction === "down") {
      if (dy < 8) continue;
      primary = dy;
      secondary = Math.abs(dx);
    } else if (dy > -8) {
      continue;
    } else {
      primary = -dy;
      secondary = Math.abs(dx);
    }
    const score = primary + secondary * 2.5;
    if (!best || score < best.score) best = { id: node.id, score };
  }

  return best?.id ?? null;
}

export function connectorHandles(
  source: MindNode,
  target: MindNode,
  options?: { preferRight?: boolean },
): { sourceHandle: string; targetHandle: string } {
  if (options?.preferRight) {
    return { sourceHandle: "source-right", targetHandle: "target-left" };
  }
  const sourceCenter = nodeCenter(source);
  const targetCenter = nodeCenter(target);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: "source-right", targetHandle: "target-left" }
      : { sourceHandle: "source-left", targetHandle: "target-right" };
  }
  return dy >= 0
    ? { sourceHandle: "source-bottom", targetHandle: "target-top" }
    : { sourceHandle: "source-top", targetHandle: "target-bottom" };
}

function clip(value: string, max: number): string {
  return Array.from(value).slice(0, max).join("");
}

export function edgeList(doc: MindMapDocument): MindEdge[] {
  return Object.values(doc.edges);
}

/** Soft-fill topics that still have pure white backgrounds from older saves. */
export function refreshDocumentStyles(doc: MindMapDocument): MindMapDocument {
  let changed = false;
  const nodes = { ...doc.nodes };
  for (const node of Object.values(doc.nodes)) {
    const style = repairTopicFill(node.style, node.nodeType);
    if (style.background !== node.style.background) {
      nodes[node.id] = { ...node, style };
      changed = true;
    }
  }
  return changed ? { ...doc, nodes } : doc;
}

export function normalizeDocument(
  input: MindMapDocument,
): { ok: true; document: MindMapDocument } | { ok: false; error: string } {
  if (!input || input.schemaVersion !== 1) {
    return { ok: false, error: "This file uses an unsupported map version." };
  }
  const doc = structuredClone(input);
  if (!doc.nodes[doc.rootId]) {
    return { ok: false, error: "This map is missing its central topic." };
  }
  if (Object.keys(doc.nodes).length > MAX_NODES) {
    return { ok: false, error: `A map can contain at most ${MAX_NODES} topics.` };
  }
  if (hasCycle(doc)) {
    return { ok: false, error: "This map contains a circular relationship." };
  }

  for (const node of Object.values(doc.nodes)) {
    if (node.id === doc.rootId) {
      node.parentId = null;
      node.floating = false;
    } else if (!node.parentId || !doc.nodes[node.parentId]) {
      node.parentId = null;
      node.floating = true;
    }
    const clean = finalizeNode(node);
    doc.nodes[node.id] = clean;
  }

  const parentIds = new Set(
    Object.values(doc.nodes)
      .map((node) => node.parentId)
      .filter((parentId): parentId is string => Boolean(parentId)),
  );
  for (const parentId of parentIds) normalizeSiblings(doc, parentId);
  syncTreeEdges(doc);
  layoutDocument(doc);
  const issues = documentIssues(doc);
  if (issues.length) return { ok: false, error: issues[0] };
  return { ok: true, document: doc };
}

export function createGeneratedMap(
  branching: number,
  depth: number,
  limit = MAX_NODES,
): MindMapDocument {
  let counter = 0;
  const createId = () => `g${counter++}`;
  const doc = createDocument({
    id: "generated",
    title: "Generated",
    rootText: "Root",
    createId,
    now: "2026-01-01T00:00:00.000Z",
  });
  const queue: { id: string; depth: number }[] = [{ id: doc.rootId, depth: 0 }];
  let cursor = 0;
  let count = 1;

  while (cursor < queue.length && count < limit) {
    const current = queue[cursor];
    cursor += 1;
    if (!current || current.depth >= depth) continue;
    const parent = doc.nodes[current.id];
    for (let index = 0; index < branching && count < limit; index += 1) {
      const id = createId();
      const isRootChild = parent.id === doc.rootId;
      const node = finalizeNode({
        id,
        parentId: parent.id,
        text: `Topic ${id}`,
        nodeType: "topic",
        side: isRootChild ? (index % 2 === 0 ? "right" : "left") : parent.side,
        sortOrder: index,
        collapsed: false,
        floating: false,
        position: { x: 0, y: 0 },
        width: 10,
        height: 10,
        style: styleForChild(parent, isRootChild, index, "topic"),
        note: "",
        href: null,
        tags: [],
        emoji: "",
        imageUrl: null,
      });
      doc.nodes[id] = node;
      count += 1;
      queue.push({ id, depth: current.depth + 1 });
    }
  }

  syncTreeEdges(doc);
  layoutDocument(doc);
  return doc;
}
