"use client";

import { BaseEdge, type Edge, type EdgeProps } from "@xyflow/react";

import type { MindEdge } from "@arbour/mindmap-core";

export type BranchFlowEdge = Edge<{ edge: MindEdge; color: string }, "branch">;

export function BranchEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
}: EdgeProps<BranchFlowEdge>) {
  const edge = data?.edge;
  const color = data?.color ?? "#78716c";
  const path = edgePath(edge?.style.path ?? "bezier", sourceX, sourceY, targetX, targetY);
  const dash =
    edge?.style.lineStyle === "dashed" ? "7 5" : edge?.style.lineStyle === "dotted" ? "1.5 4" : undefined;
  const markerId = `arrow-${id}`;

  return (
    <>
      {edge?.style.marker === "arrow" ? (
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.2 L 8 5 L 0 8.8" fill={color} />
          </marker>
        </defs>
      ) : null}
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: color,
          strokeWidth: selected ? (edge?.style.strokeWidth ?? 2) + 1 : edge?.style.strokeWidth ?? 2,
          strokeDasharray: dash,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }}
        markerEnd={edge?.style.marker === "arrow" ? `url(#${markerId})` : undefined}
      />
      {edge?.label ? (
        <text
          x={(sourceX + targetX) / 2}
          y={(sourceY + targetY) / 2 - 8}
          textAnchor="middle"
          fill="var(--arbour-muted)"
          fontSize="11"
          fontFamily="var(--font-source-sans), sans-serif"
        >
          {edge.label}
        </text>
      ) : null}
    </>
  );
}

function edgePath(
  style: "bezier" | "straight" | "orthogonal",
  sx: number,
  sy: number,
  tx: number,
  ty: number,
) {
  if (style === "straight") return `M ${sx} ${sy} L ${tx} ${ty}`;
  if (style === "orthogonal") {
    // Short stub from the parent, then a shared vertical rail — Whimsical fork look.
    const dx = tx - sx;
    const stub = Math.min(28, Math.max(12, Math.abs(dx) * 0.35)) * (dx >= 0 ? 1 : -1);
    const railX = sx + stub;
    if (Math.abs(ty - sy) < 0.5) return `M ${sx} ${sy} L ${tx} ${ty}`;
    return `M ${sx} ${sy} L ${railX} ${sy} L ${railX} ${ty} L ${tx} ${ty}`;
  }
  const dx = Math.max(36, Math.abs(tx - sx) * 0.45);
  const direction = tx >= sx ? 1 : -1;
  return `M ${sx} ${sy} C ${sx + direction * dx} ${sy}, ${tx - direction * dx} ${ty}, ${tx} ${ty}`;
}
