import type { LayoutSettings, MindMapDocument, MindNode, Point, Side } from "./types";

type Axis = "horizontal" | "vertical";
type Direction = 1 | -1;
type ChildIndex = Map<string, MindNode[]>;

/**
 * Tidy tree placement for mind maps.
 * Subtrees stack on the cross axis and grow outward on the main axis.
 * The central topic stays where the user left it. Floating topics stay put
 * and lay their own children out to the right.
 * Child lists are indexed once so a layout pass stays linear in the topic count.
 */
export function layoutDocument(doc: MindMapDocument): MindMapDocument {
  const positions = computePositions(doc);
  for (const [id, position] of Object.entries(positions)) {
    const node = doc.nodes[id];
    if (!node) continue;
    node.position = position;
  }
  return doc;
}

export function computePositions(doc: MindMapDocument): Record<string, Point> {
  const positions: Record<string, Point> = {};
  const root = doc.nodes[doc.rootId];
  if (!root) return positions;
  const index = buildChildIndex(doc);
  positions[root.id] = { ...root.position };

  if (doc.layout.orientation === "radial") layoutRadial(doc, index, positions);
  else if (doc.layout.orientation === "down" || doc.layout.orientation === "up") {
    layoutVertical(doc, index, positions);
  } else {
    layoutHorizontal(doc, index, positions);
  }

  for (const node of Object.values(doc.nodes)) {
    if (!node.floating || node.parentId) continue;
    positions[node.id] = { ...node.position };
    const kids = visibleKids(doc, index, node.id);
    if (!kids.length) continue;
    placeGroup(doc, index, kids, positions, {
      axis: "horizontal",
      dir: 1,
      mainEdge: node.position.x + node.width + doc.layout.horizontalGap,
      center: node.position.y + node.height / 2,
      depth: 1,
    });
  }

  return positions;
}

function layoutHorizontal(
  doc: MindMapDocument,
  index: ChildIndex,
  positions: Record<string, Point>,
): void {
  const root = doc.nodes[doc.rootId];
  const kids = visibleKids(doc, index, root.id);
  const orientation = doc.layout.orientation;
  const right = kids.filter((node) => resolveSide(doc, node) !== "left");
  const left = kids.filter((node) => resolveSide(doc, node) === "left");
  const usedRight = orientation === "left" ? [] : orientation === "right" ? kids : right;
  const usedLeft = orientation === "right" ? [] : orientation === "left" ? kids : left;
  const center = root.position.y + root.height / 2;

  if (usedRight.length) {
    placeGroup(doc, index, usedRight, positions, {
      axis: "horizontal",
      dir: 1,
      mainEdge: root.position.x + root.width + doc.layout.rootGap,
      center,
      depth: 1,
    });
  }
  if (usedLeft.length) {
    placeGroup(doc, index, usedLeft, positions, {
      axis: "horizontal",
      dir: -1,
      mainEdge: root.position.x - doc.layout.rootGap,
      center,
      depth: 1,
    });
  }
}

function layoutVertical(
  doc: MindMapDocument,
  index: ChildIndex,
  positions: Record<string, Point>,
): void {
  const root = doc.nodes[doc.rootId];
  const kids = visibleKids(doc, index, root.id);
  if (!kids.length) return;
  const down = doc.layout.orientation !== "up";
  placeGroup(doc, index, kids, positions, {
    axis: "vertical",
    dir: down ? 1 : -1,
    mainEdge: down
      ? root.position.y + root.height + doc.layout.rootGap
      : root.position.y - doc.layout.rootGap,
    center: root.position.x + root.width / 2,
    depth: 1,
  });
}

function layoutRadial(
  doc: MindMapDocument,
  index: ChildIndex,
  positions: Record<string, Point>,
): void {
  const root = doc.nodes[doc.rootId];
  const cx = root.position.x + root.width / 2;
  const cy = root.position.y + root.height / 2;
  const kids = visibleKids(doc, index, root.id);
  if (!kids.length) return;
  const radius = Math.max(root.width, root.height) / 2 + doc.layout.rootGap + 36;
  kids.forEach((child, childIndex) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * childIndex) / kids.length;
    placeRadial(
      doc,
      index,
      child.id,
      angle,
      radius,
      (Math.PI * 2) / kids.length,
      cx,
      cy,
      positions,
      1,
    );
  });
}

function placeRadial(
  doc: MindMapDocument,
  index: ChildIndex,
  id: string,
  angle: number,
  radius: number,
  span: number,
  cx: number,
  cy: number,
  positions: Record<string, Point>,
  depth: number,
): void {
  const node = doc.nodes[id];
  if (!node) return;
  positions[id] = {
    x: cx + Math.cos(angle) * radius - node.width / 2,
    y: cy + Math.sin(angle) * radius - node.height / 2,
  };
  const kids = visibleKids(doc, index, id);
  if (!kids.length) return;
  const childRadius =
    radius + Math.max(node.width, node.height) * 0.5 + doc.layout.horizontalGap + depth * doc.layout.levelGap;
  const childSpan = Math.max(0.15, span * 0.92);
  kids.forEach((child, childIndex) => {
    const childAngle = angle - childSpan / 2 + childSpan * ((childIndex + 0.5) / kids.length);
    placeRadial(
      doc,
      index,
      child.id,
      childAngle,
      childRadius,
      childSpan / kids.length,
      cx,
      cy,
      positions,
      depth + 1,
    );
  });
}

interface GroupOptions {
  axis: Axis;
  dir: Direction;
  mainEdge: number;
  center: number;
  depth: number;
}

function placeGroup(
  doc: MindMapDocument,
  index: ChildIndex,
  nodes: MindNode[],
  positions: Record<string, Point>,
  options: GroupOptions,
  memo: Map<string, number> = new Map(),
): void {
  const sizes = nodes.map((node) => subtreeCross(doc, index, node.id, options.axis, memo));
  const total =
    sizes.reduce((sum, size) => sum + size, 0) + Math.max(0, nodes.length - 1) * doc.layout.verticalGap;
  let cursor = options.center - total / 2;
  nodes.forEach((node, nodeIndex) => {
    placeNode(doc, index, node.id, positions, { ...options, crossStart: cursor }, memo);
    cursor += sizes[nodeIndex] + doc.layout.verticalGap;
  });
}

interface PlaceOptions extends GroupOptions {
  crossStart: number;
}

function placeNode(
  doc: MindMapDocument,
  index: ChildIndex,
  id: string,
  positions: Record<string, Point>,
  options: PlaceOptions,
  memo: Map<string, number>,
): void {
  const node = doc.nodes[id];
  if (!node) return;
  const mainSize = options.axis === "horizontal" ? node.width : node.height;
  const crossSize = options.axis === "horizontal" ? node.height : node.width;
  const span = subtreeCross(doc, index, id, options.axis, memo);
  const cross = options.crossStart + (span - crossSize) / 2;
  const main = options.dir === 1 ? options.mainEdge : options.mainEdge - mainSize;

  positions[id] = options.axis === "horizontal" ? { x: main, y: cross } : { x: cross, y: main };

  const kids = visibleKids(doc, index, id);
  if (!kids.length) return;
  const gap = doc.layout.horizontalGap + options.depth * doc.layout.levelGap;
  const childMain = options.dir === 1 ? options.mainEdge + mainSize + gap : options.mainEdge - mainSize - gap;
  placeGroup(
    doc,
    index,
    kids,
    positions,
    {
      axis: options.axis,
      dir: options.dir,
      mainEdge: childMain,
      center: options.crossStart + span / 2,
      depth: options.depth + 1,
    },
    memo,
  );
}

function subtreeCross(
  doc: MindMapDocument,
  index: ChildIndex,
  id: string,
  axis: Axis,
  memo: Map<string, number>,
): number {
  const key = `${axis}:${id}`;
  const cached = memo.get(key);
  if (cached != null) return cached;
  const node = doc.nodes[id];
  if (!node) return 0;
  const own = axis === "horizontal" ? node.height : node.width;
  memo.set(key, own);
  const kids = visibleKids(doc, index, id);
  if (!kids.length) return own;
  const stacked =
    kids.reduce((sum, child) => sum + subtreeCross(doc, index, child.id, axis, memo), 0) +
    (kids.length - 1) * doc.layout.verticalGap;
  const size = Math.max(own, stacked);
  memo.set(key, size);
  return size;
}

function resolveSide(doc: MindMapDocument, node: MindNode): Side {
  if (node.parentId === doc.rootId) return node.side === "left" ? "left" : "right";
  return "right";
}

function buildChildIndex(doc: MindMapDocument): ChildIndex {
  const index: ChildIndex = new Map();
  for (const node of Object.values(doc.nodes)) {
    if (!node.parentId) continue;
    const list = index.get(node.parentId);
    if (list) list.push(node);
    else index.set(node.parentId, [node]);
  }
  for (const list of index.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  }
  return index;
}

function visibleKids(doc: MindMapDocument, index: ChildIndex, id: string): MindNode[] {
  const node = doc.nodes[id];
  if (!node || node.collapsed) return [];
  return index.get(id) ?? [];
}

export function layoutSignature(layout: LayoutSettings): string {
  return [
    layout.orientation,
    layout.density,
    layout.horizontalGap,
    layout.verticalGap,
    layout.rootGap,
    layout.levelGap,
  ].join(":");
}

export function visibleNodeBoxes(
  doc: MindMapDocument,
): { id: string; x: number; y: number; width: number; height: number }[] {
  const index = buildChildIndex(doc);
  const boxes: { id: string; x: number; y: number; width: number; height: number }[] = [];
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return;
    const node = doc.nodes[id];
    if (!node) return;
    seen.add(id);
    boxes.push({
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      width: node.width,
      height: node.height,
    });
    if (node.collapsed) return;
    for (const child of index.get(id) ?? []) walk(child.id);
  };
  walk(doc.rootId);
  for (const node of Object.values(doc.nodes)) {
    if (node.floating && !node.parentId) walk(node.id);
  }
  return boxes;
}
