"use client";

import { BaseEdge, type Edge, type EdgeProps } from "@xyflow/react";

import { buildEdgePath, type MindEdge } from "@arbour/mindmap-core";

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
  // Nudge endpoints a hair into each topic so curves meet the border without a gap.
  const joined = extendIntoNodes(sourceX, sourceY, targetX, targetY, 1.5);
  const path = buildEdgePath(edge?.style.path ?? "bezier", joined.sx, joined.sy, joined.tx, joined.ty);
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
          x={(joined.sx + joined.tx) / 2}
          y={(joined.sy + joined.ty) / 2 - 8}
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

function extendIntoNodes(sx: number, sy: number, tx: number, ty: number, pixels: number) {
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.hypot(dx, dy);
  if (len < 1) return { sx, sy, tx, ty };
  const ux = dx / len;
  const uy = dy / len;
  return {
    sx: sx - ux * pixels,
    sy: sy - uy * pixels,
    tx: tx + ux * pixels,
    ty: ty + uy * pixels,
  };
}
