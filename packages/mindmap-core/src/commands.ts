import { createNodeId, treeEdgeId } from "./ids";
import { layoutDocument, layoutSignature } from "./layout";
import { outlineFromDocumentText, parseOutline } from "./outline";
import {
  applyInheritedBranchStyle,
  defaultEdgeStyle,
  fillForBorder,
  measureNode,
  NODE_METRICS,
  styleForChild,
  THEMES,
} from "./styles";
import {
  captureSubtree,
  childrenOf,
  createDocument,
  createsCycle,
  descendantIds,
  finalizeNode,
  nextRootSide,
  normalizeSiblings,
  subtreeIds,
  syncTreeEdges,
} from "./document";
import {
  MAX_NODES,
  type ApplyContext,
  type Command,
  type CommandResult,
  type MindMapDocument,
  type MindNode,
  type NodeId,
  type NodeType,
  type Point,
  type Side,
  type SubtreeSnapshot,
} from "./types";

interface MutationContext {
  createId: () => string;
  now: () => string;
}

interface MutationResult {
  changed: boolean;
  focusId?: NodeId;
  error?: string;
}

const LIMIT_ERROR = `A map can contain at most ${MAX_NODES} topics.`;

function uniqueId(doc: MindMapDocument, createId: () => string): string {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = createId();
    if (id && !doc.nodes[id]) return id;
  }
  return `node_${Object.keys(doc.nodes).length}_${Math.random().toString(36).slice(2, 8)}`;
}

export function applyCommand(
  doc: MindMapDocument,
  command: Command,
  ctx: ApplyContext = {},
): CommandResult {
  const context: MutationContext = {
    createId: ctx.createId ?? createNodeId,
    now: ctx.now ?? (() => new Date().toISOString()),
  };

  if (command.type === "replaceDocument") {
    return {
      document: command.document,
      changed: true,
      focusId: command.document.rootId,
    };
  }

  const next = structuredClone(doc);
  const result = mutate(next, command, context);
  if (!result.changed) return { document: doc, changed: false, error: result.error };
  next.updatedAt = context.now();
  return { document: next, changed: true, focusId: result.focusId };
}

export function documentFromOutline(
  outline: string,
  title?: string,
  ctx: ApplyContext = {},
): MindMapDocument | null {
  const lines = parseOutline(outline);
  if (!lines.length) return documentFromDocumentText(outline, title, ctx);
  return buildDocumentFromLines(lines, title, ctx);
}

/** Build a map from prose (PDF extract / plain paragraphs), not only Markdown outlines. */
export function documentFromDocumentText(
  text: string,
  title?: string,
  ctx: ApplyContext = {},
): MindMapDocument | null {
  const lines = outlineFromDocumentText(text);
  if (!lines.length) return null;
  return buildDocumentFromLines(lines, title, ctx);
}

function buildDocumentFromLines(
  lines: { depth: number; text: string }[],
  title: string | undefined,
  ctx: ApplyContext,
): MindMapDocument | null {
  if (!lines.length) return null;
  const rootText = lines[0].text || "Imported outline";
  let doc = createDocument({
    title: title?.trim() || rootText,
    rootText,
    createId: ctx.createId,
    now: ctx.now?.(),
  });
  const rest = lines.slice(1);
  if (!rest.length) return doc;
  // Build under the new root from already-parsed depths (avoid re-indent round-trip).
  const relative = rest
    .map((line) => ({ depth: Math.max(0, line.depth - 1), text: line.text }))
    .slice(0, MAX_NODES);
  const mutationCtx: MutationContext = {
    createId: ctx.createId ?? createNodeId,
    now: ctx.now ?? (() => new Date().toISOString()),
  };
  if (Object.keys(doc.nodes).length + relative.length > MAX_NODES) return null;
  const stack: { depth: number; id: string }[] = [{ depth: -1, id: doc.rootId }];
  for (const line of relative) {
    while (stack.length > 1 && stack[stack.length - 1].depth >= line.depth) stack.pop();
    const parent = stack[stack.length - 1]?.id ?? doc.rootId;
    const id = insertChild(doc, parent, { text: line.text }, mutationCtx);
    if (!id) return null;
    stack.push({ depth: line.depth, id });
  }
  finish(doc);
  return doc;
}

function mutate(doc: MindMapDocument, command: Command, ctx: MutationContext): MutationResult {
  switch (command.type) {
    case "setTitle":
      return setTitle(doc, command.title);
    case "addChild":
      return addChild(doc, command, ctx);
    case "addSibling":
      return addSibling(doc, command, ctx);
    case "addParent":
      return addParent(doc, command, ctx);
    case "addFloating":
      return addFloating(doc, command, ctx);
    case "deleteNodes":
      return deleteNodes(doc, command.ids);
    case "rename":
      return renameNode(doc, command.nodeId, command.text);
    case "reparent":
      return reparent(doc, command);
    case "reorder":
      return reorder(doc, command.nodeId, command.index);
    case "setSide":
      return setSide(doc, command.nodeId, command.side);
    case "promote":
      return promote(doc, command.nodeId);
    case "toggleCollapse":
      return toggleCollapse(doc, command.nodeId);
    case "setCollapsed":
      return setCollapsed(doc, command.ids, command.collapsed);
    case "renameMany":
      return renameMany(doc, command.updates);
    case "duplicate":
      return duplicate(doc, command.nodeId, ctx);
    case "patchNodes":
      return patchNodes(doc, command);
    case "paintSubtree":
      return paintSubtree(doc, command.nodeId, command.borderColor);
    case "patchEdges":
      return patchEdges(doc, command);
    case "addLink":
      return addLink(doc, command.sourceId, command.targetId, ctx);
    case "deleteEdges":
      return deleteEdges(doc, command.ids);
    case "pasteOutline":
      return pasteOutline(doc, command.parentId, command.outline, ctx);
    case "pasteSubtree":
      return pasteSnapshot(doc, command.parentId, command.snapshot, ctx, command.position);
    case "setLayout":
      return setLayout(doc, command.layout);
    case "relayout":
      return relayout(doc);
    case "applyTheme":
      return applyTheme(doc, command.themeId);
    case "moveFloating":
      return moveFloating(doc, command.nodeId, command.position);
    case "nudge":
      return nudge(doc, command.nodeId, command.dx, command.dy);
    default:
      return { changed: false };
  }
}

function setTitle(doc: MindMapDocument, title: string): MutationResult {
  const next = Array.from(title).slice(0, 120).join("").trim() || "Untitled map";
  if (next === doc.title) return { changed: false };
  doc.title = next;
  return { changed: true };
}

function addChild(
  doc: MindMapDocument,
  command: Extract<Command, { type: "addChild" }>,
  ctx: MutationContext,
): MutationResult {
  const id = insertChild(doc, command.parentId, command, ctx);
  if (!id) return { changed: false, error: missingParentOrLimit(doc, command.parentId) };
  finish(doc);
  return { changed: true, focusId: id };
}

function addSibling(
  doc: MindMapDocument,
  command: Extract<Command, { type: "addSibling" }>,
  ctx: MutationContext,
): MutationResult {
  const node = doc.nodes[command.nodeId];
  if (!node) return { changed: false };
  const placeAbove = command.placement === "above";
  if (!node.parentId || node.id === doc.rootId) {
    if (node.floating) {
      return addFloating(
        doc,
        {
          type: "addFloating",
          position: {
            x: node.position.x + 36,
            y: placeAbove ? node.position.y - node.height - 28 : node.position.y + node.height + 28,
          },
          text: command.text,
          nodeType: command.nodeType,
        },
        ctx,
      );
    }
    return addChild(doc, { type: "addChild", parentId: doc.rootId, text: command.text, nodeType: command.nodeType }, ctx);
  }
  const siblings = childrenOf(doc, node.parentId);
  const index = siblings.findIndex((item) => item.id === node.id);
  const id = insertChild(
    doc,
    node.parentId,
    {
      text: command.text,
      nodeType: command.nodeType,
      side: node.side,
      index: placeAbove ? index : index + 1,
    },
    ctx,
  );
  if (!id) return { changed: false, error: LIMIT_ERROR };
  finish(doc);
  return { changed: true, focusId: id };
}

function addParent(
  doc: MindMapDocument,
  command: Extract<Command, { type: "addParent" }>,
  ctx: MutationContext,
): MutationResult {
  const node = doc.nodes[command.nodeId];
  if (!node) return { changed: false };
  if (node.id === doc.rootId) {
    return { changed: false, error: "The central topic already sits at the top of the map." };
  }

  if (node.floating || !node.parentId) {
    const parentResult = addFloating(
      doc,
      {
        type: "addFloating",
        position: { x: node.position.x, y: node.position.y - node.height - 48 },
        text: command.text,
        nodeType: command.nodeType,
      },
      ctx,
    );
    if (!parentResult.changed || !parentResult.focusId) return parentResult;
    const moved = reparent(doc, {
      type: "reparent",
      nodeId: node.id,
      parentId: parentResult.focusId,
      index: 0,
      side: node.side,
    });
    if (!moved.changed) return moved;
    return { changed: true, focusId: parentResult.focusId };
  }

  const siblings = childrenOf(doc, node.parentId);
  const index = siblings.findIndex((item) => item.id === node.id);
  const parentId = insertChild(
    doc,
    node.parentId,
    {
      text: command.text,
      nodeType: command.nodeType,
      side: node.side,
      index,
    },
    ctx,
  );
  if (!parentId) return { changed: false, error: LIMIT_ERROR };
  const moved = reparent(doc, {
    type: "reparent",
    nodeId: node.id,
    parentId,
    index: 0,
    side: node.side,
  });
  if (!moved.changed) return moved;
  return { changed: true, focusId: parentId };
}

function addFloating(
  doc: MindMapDocument,
  command: Extract<Command, { type: "addFloating" }>,
  ctx: MutationContext,
): MutationResult {
  if (Object.keys(doc.nodes).length >= MAX_NODES) return { changed: false, error: LIMIT_ERROR };
  const nodeType = command.nodeType ?? "topic";
  const node = finalizeNode({
    id: uniqueId(doc, ctx.createId),
    parentId: null,
    text: command.text?.trim() || defaultText(nodeType),
    nodeType,
    side: "right",
    sortOrder: 0,
    collapsed: false,
    floating: true,
    position: command.position,
    width: 80,
    height: 40,
    style: styleForChild(
      doc.nodes[doc.rootId],
      true,
      Object.keys(doc.nodes).length,
      nodeType,
      doc.layout.nodeLook ?? "cards",
    ),
    note: "",
    href: null,
    tags: [],
    emoji: "",
    imageUrl: command.imageUrl ?? null,
  });
  doc.nodes[node.id] = node;
  finish(doc);
  return { changed: true, focusId: node.id };
}

function deleteNodes(doc: MindMapDocument, ids: NodeId[]): MutationResult {
  const deleting = new Set<NodeId>();
  for (const id of ids) {
    if (!doc.nodes[id] || id === doc.rootId) continue;
    for (const subId of subtreeIds(doc, id)) {
      if (subId !== doc.rootId) deleting.add(subId);
    }
  }
  if (!deleting.size) {
    return {
      changed: false,
      error: ids.includes(doc.rootId) ? "The central topic can't be deleted." : undefined,
    };
  }
  const parents = new Set<NodeId>();
  for (const id of deleting) {
    const parentId = doc.nodes[id]?.parentId;
    if (parentId && !deleting.has(parentId)) parents.add(parentId);
  }
  for (const id of deleting) delete doc.nodes[id];
  for (const parentId of parents) normalizeSiblings(doc, parentId);
  finish(doc);
  return { changed: true };
}

function renameNode(doc: MindMapDocument, nodeId: NodeId, text: string): MutationResult {
  const node = doc.nodes[nodeId];
  if (!node) return { changed: false };
  const next = finalizeNode({ ...node, text });
  if (next.text === node.text && next.width === node.width && next.height === node.height) {
    return { changed: false };
  }
  doc.nodes[nodeId] = next;
  finish(doc);
  return { changed: true, focusId: nodeId };
}

function reparent(doc: MindMapDocument, command: Extract<Command, { type: "reparent" }>): MutationResult {
  const node = doc.nodes[command.nodeId];
  const parent = doc.nodes[command.parentId];
  if (!node || !parent) return { changed: false };
  if (node.id === doc.rootId) return { changed: false, error: "The central topic stays at the center." };
  if (createsCycle(doc, node.id, parent.id)) {
    return { changed: false, error: "A topic can't be placed inside itself." };
  }
  const previousParent = node.parentId;
  node.parentId = parent.id;
  node.floating = false;
  node.side = parent.id === doc.rootId ? command.side ?? nextRootSide(doc) : parent.side;
  for (const id of descendantIds(doc, node.id)) {
    if (doc.nodes[id]?.parentId !== doc.rootId) doc.nodes[id].side = node.side;
  }
  if (parent.collapsed) parent.collapsed = false;
  const siblings = childrenOf(doc, parent.id).filter((item) => item.id !== node.id);
  const index =
    command.index == null ? siblings.length : Math.max(0, Math.min(command.index, siblings.length));
  siblings.splice(index, 0, node);
  siblings.forEach((item, itemIndex) => {
    item.sortOrder = itemIndex;
  });
  if (previousParent && previousParent !== parent.id) normalizeSiblings(doc, previousParent);
  inheritBranchPaint(doc, node.id);
  finish(doc);
  return { changed: true, focusId: node.id };
}

/** Refresh branch fill/shape/border after a move (Whimsical-style inheritance). */
function inheritBranchPaint(doc: MindMapDocument, nodeId: NodeId): void {
  const node = doc.nodes[nodeId];
  if (!node?.parentId) return;
  const parent = doc.nodes[node.parentId];
  if (!parent) return;
  const siblings = childrenOf(doc, parent.id);
  const index = siblings.findIndex((item) => item.id === node.id);
  const isRootChild = parent.id === doc.rootId;
  const nextStyle = applyInheritedBranchStyle(
    node,
    parent,
    isRootChild,
    Math.max(0, index),
    doc.layout.nodeLook ?? "cards",
  );
  if (nextStyle !== node.style) {
    doc.nodes[nodeId] = finalizeNode({ ...node, style: nextStyle });
  }
  for (const child of childrenOf(doc, nodeId)) inheritBranchPaint(doc, child.id);
}

function reorder(doc: MindMapDocument, nodeId: NodeId, index: number): MutationResult {
  const node = doc.nodes[nodeId];
  if (!node?.parentId) return { changed: false };
  const siblings = childrenOf(doc, node.parentId);
  const current = siblings.findIndex((item) => item.id === node.id);
  const nextIndex = Math.max(0, Math.min(index, siblings.length - 1));
  if (current < 0 || current === nextIndex) return { changed: false };
  const [item] = siblings.splice(current, 1);
  siblings.splice(nextIndex, 0, item);
  siblings.forEach((sibling, siblingIndex) => {
    sibling.sortOrder = siblingIndex;
  });
  finish(doc);
  return { changed: true, focusId: nodeId };
}

function setSide(doc: MindMapDocument, nodeId: NodeId, side: Side): MutationResult {
  const node = doc.nodes[nodeId];
  if (!node || node.parentId !== doc.rootId) {
    return { changed: false, error: "Only a main branch can switch sides." };
  }
  if (node.side === side) return { changed: false };
  node.side = side;
  for (const id of descendantIds(doc, node.id)) doc.nodes[id].side = side;
  finish(doc);
  return { changed: true, focusId: nodeId };
}

function promote(doc: MindMapDocument, nodeId: NodeId): MutationResult {
  const node = doc.nodes[nodeId];
  if (!node?.parentId) return { changed: false };
  const parent = doc.nodes[node.parentId];
  if (!parent?.parentId) return { changed: false };
  const siblings = childrenOf(doc, parent.parentId);
  const parentIndex = siblings.findIndex((item) => item.id === parent.id);
  return reparent(doc, {
    type: "reparent",
    nodeId,
    parentId: parent.parentId,
    index: parentIndex + 1,
    side: parent.side,
  });
}

function toggleCollapse(doc: MindMapDocument, nodeId: NodeId): MutationResult {
  const node = doc.nodes[nodeId];
  if (!node || !childrenOf(doc, nodeId).length) return { changed: false };
  node.collapsed = !node.collapsed;
  finish(doc);
  return { changed: true, focusId: nodeId };
}

function setCollapsed(doc: MindMapDocument, ids: NodeId[], collapsed: boolean): MutationResult {
  let changed = false;
  let focusId: NodeId | undefined;
  for (const id of ids) {
    const node = doc.nodes[id];
    if (!node || !childrenOf(doc, id).length) continue;
    if (node.collapsed === collapsed) continue;
    node.collapsed = collapsed;
    changed = true;
    focusId = id;
  }
  if (!changed) return { changed: false };
  finish(doc);
  return { changed: true, focusId };
}

function renameMany(
  doc: MindMapDocument,
  updates: { nodeId: NodeId; text: string }[],
): MutationResult {
  let changed = false;
  for (const update of updates) {
    const node = doc.nodes[update.nodeId];
    if (!node) continue;
    const next = finalizeNode({ ...node, text: update.text });
    if (node.text === next.text) continue;
    doc.nodes[update.nodeId] = next;
    changed = true;
  }
  if (!changed) return { changed: false };
  finish(doc);
  return { changed: true };
}

function duplicate(doc: MindMapDocument, nodeId: NodeId, ctx: MutationContext): MutationResult {
  const node = doc.nodes[nodeId];
  const snapshot = captureSubtree(doc, nodeId);
  if (!node || !snapshot) return { changed: false };
  if (node.floating || node.id === doc.rootId) {
    return pasteSnapshot(doc, null, snapshot, ctx, {
      x: node.position.x + 48,
      y: node.position.y + 48,
    });
  }
  const siblings = childrenOf(doc, node.parentId!);
  const index = siblings.findIndex((item) => item.id === node.id);
  return pasteSnapshot(doc, node.parentId, snapshot, ctx, undefined, index + 1, node.side);
}

function patchNodes(
  doc: MindMapDocument,
  command: Extract<Command, { type: "patchNodes" }>,
): MutationResult {
  let changed = false;
  let sizeChanged = false;
  for (const id of command.ids) {
    const node = doc.nodes[id];
    if (!node) continue;
    const next = finalizeNode({
      ...node,
      style: command.style ? { ...node.style, ...command.style, themeLock: true } : node.style,
      note: command.note ?? node.note,
      href: command.href === undefined ? node.href : command.href,
      tags: command.tags ?? node.tags,
      emoji: command.emoji ?? node.emoji,
      imageUrl: command.imageUrl === undefined ? node.imageUrl : command.imageUrl,
      nodeType: command.nodeType ?? node.nodeType,
    });
    if (command.style) next.style.themeLock = true;
    if (sameNode(node, next)) continue;
    if (next.width !== node.width || next.height !== node.height) sizeChanged = true;
    doc.nodes[id] = next;
    changed = true;
  }
  if (!changed) return { changed: false };
  if (sizeChanged) finish(doc);
  else syncTreeEdges(doc);
  return { changed: true };
}

function paintSubtree(doc: MindMapDocument, nodeId: NodeId, borderColor: string): MutationResult {
  if (!doc.nodes[nodeId]) return { changed: false };
  let changed = false;
  const fill = fillForBorder(borderColor);
  for (const id of subtreeIds(doc, nodeId)) {
    const node = doc.nodes[id];
    if (!node) continue;
    const isRootChild = node.parentId === doc.rootId;
    const background =
      node.nodeType !== "topic"
        ? node.style.background
        : isRootChild
          ? fill
          : node.style.shape === "underline" || node.style.shape === "borderless"
            ? "transparent"
            : fill;
    if (
      node.style.borderColor === borderColor &&
      node.style.background === background
    ) {
      continue;
    }
    node.style = {
      ...node.style,
      borderColor,
      background,
      themeLock: true,
    };
    changed = true;
  }
  if (!changed) return { changed: false };
  syncTreeEdges(doc);
  return { changed: true, focusId: nodeId };
}

function patchEdges(
  doc: MindMapDocument,
  command: Extract<Command, { type: "patchEdges" }>,
): MutationResult {
  let changed = false;
  for (const id of command.ids) {
    const edge = doc.edges[id];
    if (!edge) continue;
    if (command.label !== undefined) edge.label = Array.from(command.label).slice(0, 80).join("");
    if (command.style) {
      edge.style = {
        ...edge.style,
        ...command.style,
        followNode: command.style.stroke ? false : command.style.followNode ?? edge.style.followNode,
      };
    }
    changed = true;
  }
  return { changed };
}

function addLink(
  doc: MindMapDocument,
  sourceId: NodeId,
  targetId: NodeId,
  ctx: MutationContext,
): MutationResult {
  if (sourceId === targetId) return { changed: false, error: "Choose two different topics." };
  if (!doc.nodes[sourceId] || !doc.nodes[targetId]) return { changed: false };
  const exists = Object.values(doc.edges).some(
    (edge) =>
      edge.kind === "link" &&
      ((edge.sourceId === sourceId && edge.targetId === targetId) ||
        (edge.sourceId === targetId && edge.targetId === sourceId)),
  );
  if (exists) return { changed: false, error: "Those topics are already linked." };
  const id = uniqueId(doc, ctx.createId);
  doc.edges[id] = {
    id,
    sourceId,
    targetId,
    kind: "link",
    label: "",
    style: defaultEdgeStyle("#78716c", "link"),
  };
  return { changed: true };
}

function deleteEdges(doc: MindMapDocument, ids: string[]): MutationResult {
  let changed = false;
  for (const id of ids) {
    const edge = doc.edges[id];
    if (!edge || edge.kind === "tree") continue;
    delete doc.edges[id];
    changed = true;
  }
  return { changed, error: changed ? undefined : "Branch connectors follow the topic structure." };
}

function pasteOutline(
  doc: MindMapDocument,
  parentId: NodeId,
  outline: string,
  ctx: MutationContext,
): MutationResult {
  if (!doc.nodes[parentId]) return { changed: false };
  const lines = parseOutline(outline).slice(0, MAX_NODES);
  if (!lines.length) return { changed: false, error: "That outline is empty." };
  if (Object.keys(doc.nodes).length + lines.length > MAX_NODES) return { changed: false, error: LIMIT_ERROR };
  const stack: { depth: number; id: string }[] = [{ depth: -1, id: parentId }];
  let lastId = parentId;
  for (const line of lines) {
    while (stack.length > 1 && stack[stack.length - 1].depth >= line.depth) stack.pop();
    const parent = stack[stack.length - 1]?.id ?? parentId;
    const id = insertChild(doc, parent, { text: line.text }, ctx);
    if (!id) return { changed: false, error: LIMIT_ERROR };
    stack.push({ depth: line.depth, id });
    lastId = id;
  }
  finish(doc);
  return { changed: true, focusId: lastId };
}

function setLayout(doc: MindMapDocument, layout: Partial<MindMapDocument["layout"]>): MutationResult {
  const next = { ...doc.layout, ...layout };
  if (layoutSignature(doc.layout) === layoutSignature(next)) return { changed: false };
  doc.layout = next;
  finish(doc);
  return { changed: true };
}

function relayout(doc: MindMapDocument): MutationResult {
  const before = positionKey(doc);
  layoutDocument(doc);
  return { changed: before !== positionKey(doc) };
}

function applyTheme(doc: MindMapDocument, themeId: string): MutationResult {
  const theme = THEMES.find((item) => item.id === themeId);
  if (!theme) return { changed: false };
  let changed = false;
  for (const node of Object.values(doc.nodes)) {
    if (node.style.themeLock) continue;
    const patch =
      node.id === doc.rootId ? theme.root : node.nodeType === "note" ? theme.note : node.nodeType === "text" ? null : theme.branch;
    if (!patch) continue;
    const next = finalizeNode({
      ...node,
      style: { ...node.style, ...patch, themeLock: false },
    });
    next.style.themeLock = false;
    doc.nodes[node.id] = next;
    changed = true;
  }
  if (!changed) return { changed: false };
  finish(doc);
  return { changed: true };
}

function moveFloating(doc: MindMapDocument, nodeId: NodeId, position: Point): MutationResult {
  const node = doc.nodes[nodeId];
  if (!node || node.id === doc.rootId) {
    return { changed: false, error: node ? "The central topic stays in the layout." : undefined };
  }
  const dx = position.x - node.position.x;
  const dy = position.y - node.position.y;
  const previousParent = node.parentId;
  if (!node.floating && previousParent == null && Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
    return { changed: false };
  }
  node.floating = true;
  node.parentId = null;
  node.position = { x: position.x, y: position.y };
  for (const id of descendantIds(doc, node.id)) {
    const child = doc.nodes[id];
    child.position = { x: child.position.x + dx, y: child.position.y + dy };
  }
  if (previousParent) normalizeSiblings(doc, previousParent);
  delete doc.edges[treeEdgeId(node.id)];
  syncTreeEdges(doc);
  const changed = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5 || previousParent !== null;
  return { changed, focusId: node.id };
}

function nudge(doc: MindMapDocument, nodeId: NodeId, dx: number, dy: number): MutationResult {
  const node = doc.nodes[nodeId];
  if (!node?.floating) return { changed: false };
  return moveFloating(doc, nodeId, { x: node.position.x + dx, y: node.position.y + dy });
}

function pasteSnapshot(
  doc: MindMapDocument,
  parentId: NodeId | null,
  snapshot: SubtreeSnapshot,
  ctx: MutationContext,
  floatingPosition?: Point,
  index?: number,
  side?: Side,
): MutationResult {
  if (!snapshot.nodes.length) return { changed: false };
  if (parentId && !doc.nodes[parentId]) return { changed: false };
  if (Object.keys(doc.nodes).length + snapshot.nodes.length > MAX_NODES) {
    return { changed: false, error: LIMIT_ERROR };
  }
  const idMap = new Map<string, string>();
  for (const node of snapshot.nodes) idMap.set(node.id, uniqueId(doc, ctx.createId));
  const newRootId = idMap.get(snapshot.rootId);
  if (!newRootId) return { changed: false };
  const sourceRoot = snapshot.nodes.find((node) => node.id === snapshot.rootId);
  const dx = floatingPosition && sourceRoot ? floatingPosition.x - sourceRoot.position.x : 0;
  const dy = floatingPosition && sourceRoot ? floatingPosition.y - sourceRoot.position.y : 0;
  const branchSide = parentId
    ? (side ?? (parentId === doc.rootId ? nextRootSide(doc) : doc.nodes[parentId].side))
    : undefined;

  for (const source of snapshot.nodes) {
    const id = idMap.get(source.id);
    if (!id) continue;
    const isRoot = source.id === snapshot.rootId;
    const mappedParent = source.parentId ? idMap.get(source.parentId) ?? null : null;
    const copy = finalizeNode({
      ...structuredClone(source),
      id,
      parentId: isRoot ? parentId : mappedParent,
      floating: isRoot ? !parentId : false,
      position: {
        x: source.position.x + dx,
        y: source.position.y + dy,
      },
    });
    doc.nodes[id] = copy;
  }

  if (parentId && branchSide) {
    for (const id of idMap.values()) doc.nodes[id].side = branchSide;
  }

  if (parentId) {
    const siblings = childrenOf(doc, parentId).filter((node) => node.id !== newRootId);
    const insertAt = index == null ? siblings.length : Math.max(0, Math.min(index, siblings.length));
    siblings.splice(insertAt, 0, doc.nodes[newRootId]);
    siblings.forEach((node, itemIndex) => {
      node.sortOrder = itemIndex;
    });
    if (doc.nodes[parentId].collapsed) doc.nodes[parentId].collapsed = false;
  }

  for (const edge of snapshot.edges) {
    if (edge.kind === "tree") continue;
    const sourceId = idMap.get(edge.sourceId);
    const targetId = idMap.get(edge.targetId);
    if (!sourceId || !targetId) continue;
    const id = uniqueId(doc, ctx.createId);
    doc.edges[id] = { ...structuredClone(edge), id, sourceId, targetId };
  }

  finish(doc);
  return { changed: true, focusId: newRootId };
}

function insertChild(
  doc: MindMapDocument,
  parentId: NodeId,
  options: {
    text?: string;
    nodeType?: NodeType;
    side?: Side;
    imageUrl?: string | null;
    index?: number;
  },
  ctx: MutationContext,
): NodeId | null {
  const parent = doc.nodes[parentId];
  if (!parent || Object.keys(doc.nodes).length >= MAX_NODES) return null;
  const nodeType = options.nodeType ?? "topic";
  const siblings = childrenOf(doc, parentId);
  const isRootChild = parentId === doc.rootId;
  const node = finalizeNode({
    id: uniqueId(doc, ctx.createId),
    parentId,
    text: options.text?.trim() || defaultText(nodeType),
    nodeType,
    side: isRootChild ? options.side ?? nextRootSide(doc) : parent.side,
    sortOrder: siblings.length,
    collapsed: false,
    floating: false,
    position: { x: parent.position.x + parent.width + 40, y: parent.position.y },
    width: 80,
    height: 40,
    style: styleForChild(parent, isRootChild, siblings.length, nodeType),
    note: "",
    href: null,
    tags: [],
    emoji: "",
    imageUrl: options.imageUrl ?? null,
  });
  doc.nodes[node.id] = node;
  if (parent.collapsed) parent.collapsed = false;
  // Underline leaves become boxed parents once they gain children (Whimsical ladder).
  if (
    siblings.length === 0 &&
    parent.style.shape === "underline" &&
    parent.nodeType === "topic" &&
    parent.id !== doc.rootId
  ) {
    parent.style = {
      ...parent.style,
      shape: "rounded",
      background: fillForBorder(parent.style.borderColor),
      shadow: "soft",
      borderWidth: NODE_METRICS.border,
      borderStyle: "solid",
    };
    const size = measureNode(parent);
    parent.width = size.width;
    parent.height = size.height;
  }
  const ordered = siblings.map((item) => item.id);
  const index =
    options.index == null ? ordered.length : Math.max(0, Math.min(options.index, ordered.length));
  ordered.splice(index, 0, node.id);
  ordered.forEach((id, itemIndex) => {
    doc.nodes[id].sortOrder = itemIndex;
  });
  return node.id;
}

function finish(doc: MindMapDocument): void {
  syncTreeEdges(doc);
  layoutDocument(doc);
}

function missingParentOrLimit(doc: MindMapDocument, parentId: NodeId): string {
  if (!doc.nodes[parentId]) return "That topic is no longer on the map.";
  return LIMIT_ERROR;
}

function defaultText(nodeType: NodeType): string {
  if (nodeType === "note") return "Note";
  if (nodeType === "text") return "Text";
  if (nodeType === "image") return "Image";
  return "New topic";
}

function positionKey(doc: MindMapDocument): string {
  return Object.values(doc.nodes)
    .map((node) => `${node.id}:${node.position.x.toFixed(1)},${node.position.y.toFixed(1)}`)
    .join("|");
}

function sameNode(a: MindNode, b: MindNode): boolean {
  return (
    a.text === b.text &&
    a.note === b.note &&
    a.href === b.href &&
    a.emoji === b.emoji &&
    a.imageUrl === b.imageUrl &&
    a.nodeType === b.nodeType &&
    a.tags.join("\u0000") === b.tags.join("\u0000") &&
    JSON.stringify(a.style) === JSON.stringify(b.style) &&
    a.width === b.width &&
    a.height === b.height
  );
}
