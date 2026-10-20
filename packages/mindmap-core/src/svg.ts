import { isNodeVisible } from "./document";
import { escapeXml } from "./security";
import { fontStack } from "./styles";
import type { MindMapDocument, MindNode, NodeShape } from "./types";

export function toSvg(doc: MindMapDocument): string {
  const nodes = Object.values(doc.nodes).filter((node) => isNodeVisible(doc, node.id));
  if (!nodes.length) return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"></svg>`;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + node.width);
    maxY = Math.max(maxY, node.position.y + node.height);
  }
  const pad = 48;
  const width = Math.max(1, Math.ceil(maxX - minX + pad * 2));
  const height = Math.max(1, Math.ceil(maxY - minY + pad * 2));
  const offsetX = pad - minX;
  const offsetY = pad - minY;

  const edges = Object.values(doc.edges)
    .filter((edge) => isNodeVisible(doc, edge.sourceId) && isNodeVisible(doc, edge.targetId))
    .map((edge) => drawEdge(doc, edge.sourceId, edge.targetId, edge.style.stroke, edge.style.strokeWidth, edge.style.lineStyle, edge.style.path, edge.style.marker, edge.label, edge.style.followNode, offsetX, offsetY))
    .join("");

  const shapes = nodes.map((node) => drawNode(node, offsetX, offsetY)).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
  <rect width="100%" height="100%" fill="#f6f4f0"/>
  ${edges}
  ${shapes}
</svg>`;
}

function drawNode(node: MindNode, offsetX: number, offsetY: number): string {
  const x = node.position.x + offsetX;
  const y = node.position.y + offsetY;
  const fill = node.style.shape === "borderless" || node.style.shape === "underline" ? "transparent" : node.style.background;
  const stroke = node.style.borderStyle === "none" ? "none" : node.style.borderColor;
  const dash = dashArray(node.style.borderStyle);
  const shape = drawShape(node.style.shape, x, y, node.width, node.height, fill, stroke, node.style.borderWidth, dash, node.style.opacity);
  const label = `${node.emoji ? `${node.emoji} ` : ""}${node.text}`;
  const textY = y + node.height / 2;
  return `${shape}<text x="${x + node.width / 2}" y="${textY}" text-anchor="middle" dominant-baseline="middle" fill="${escapeXml(node.style.color)}" font-family="${escapeXml(fontStack(node.style.fontFamily))}" font-size="${node.style.fontSize}" font-weight="${node.style.fontWeight}" font-style="${node.style.fontStyle}">${escapeXml(label)}</text>`;
}

function drawShape(
  shape: NodeShape,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  stroke: string,
  strokeWidth: number,
  dash: string,
  opacity: number,
): string {
  const common = `fill="${escapeXml(fill)}" stroke="${escapeXml(stroke)}" stroke-width="${strokeWidth}" ${dash} opacity="${opacity}"`;
  if (shape === "ellipse") {
    return `<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${width / 2}" ry="${height / 2}" ${common}/>`;
  }
  if (shape === "underline") {
    return `<line x1="${x}" y1="${y + height - 2}" x2="${x + width}" y2="${y + height - 2}" stroke="${escapeXml(stroke)}" stroke-width="1.5"/>`;
  }
  if (shape === "borderless") return "";
  const radius = shape === "pill" ? height / 2 : shape === "rectangle" ? 4 : 12;
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" ${common}/>`;
}

function drawEdge(
  doc: MindMapDocument,
  sourceId: string,
  targetId: string,
  stroke: string,
  strokeWidth: number,
  lineStyle: "solid" | "dashed" | "dotted",
  pathStyle: "bezier" | "straight" | "orthogonal",
  marker: "none" | "arrow",
  label: string,
  followNode: boolean,
  offsetX: number,
  offsetY: number,
): string {
  const source = doc.nodes[sourceId];
  const target = doc.nodes[targetId];
  if (!source || !target) return "";
  const color = followNode ? target.style.borderColor : stroke;
  const start = anchor(source, target, true, offsetX, offsetY);
  const end = anchor(source, target, false, offsetX, offsetY);
  const d = edgePath(pathStyle, start.x, start.y, end.x, end.y);
  const dash = lineStyle === "dashed" ? 'stroke-dasharray="7 5"' : lineStyle === "dotted" ? 'stroke-dasharray="1.5 4"' : "";
  const markerAttr = marker === "arrow" ? `marker-end="url(#arrow-${escapeXml(color).replace("#", "")})"` : "";
  const labelMarkup = label
    ? `<text x="${(start.x + end.x) / 2}" y="${(start.y + end.y) / 2 - 6}" text-anchor="middle" fill="#78716c" font-size="11" font-family="Source Sans 3, sans-serif">${escapeXml(label)}</text>`
    : "";
  const markerDef =
    marker === "arrow"
      ? `<defs><marker id="arrow-${color.replace("#", "")}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1.2 L 8 5 L 0 8.8" fill="${escapeXml(color)}"/></marker></defs>`
      : "";
  return `${markerDef}<path d="${d}" fill="none" stroke="${escapeXml(color)}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" ${dash} ${markerAttr}/>${labelMarkup}`;
}

function anchor(
  source: MindNode,
  target: MindNode,
  isSource: boolean,
  offsetX: number,
  offsetY: number,
): { x: number; y: number } {
  const node = isSource ? source : target;
  const other = isSource ? target : source;
  const cx = node.position.x + node.width / 2;
  const cy = node.position.y + node.height / 2;
  const ox = other.position.x + other.width / 2;
  const oy = other.position.y + other.height / 2;
  const dx = ox - cx;
  const dy = oy - cy;
  let x = cx;
  let y = cy;
  if (Math.abs(dx) >= Math.abs(dy)) x += dx >= 0 ? node.width / 2 : -node.width / 2;
  else y += dy >= 0 ? node.height / 2 : -node.height / 2;
  return { x: x + offsetX, y: y + offsetY };
}

function edgePath(
  style: "bezier" | "straight" | "orthogonal",
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): string {
  if (style === "straight") return `M ${sx} ${sy} L ${tx} ${ty}`;
  if (style === "orthogonal") {
    const mid = sx + (tx - sx) / 2;
    return `M ${sx} ${sy} L ${mid} ${sy} L ${mid} ${ty} L ${tx} ${ty}`;
  }
  const dx = Math.max(36, Math.abs(tx - sx) * 0.45);
  const dir = tx >= sx ? 1 : -1;
  return `M ${sx} ${sy} C ${sx + dir * dx} ${sy}, ${tx - dir * dx} ${ty}, ${tx} ${ty}`;
}

function dashArray(style: MindNode["style"]["borderStyle"]): string {
  if (style === "dashed") return 'stroke-dasharray="6 4"';
  if (style === "dotted") return 'stroke-dasharray="1.5 3"';
  return "";
}
