"use client";

import { getViewportForBounds, type Rect } from "@xyflow/react";
import { isNodeVisible } from "@arbour/mindmap-core";

import { useEditor } from "@/features/editor/store";

type Viewport = { x: number; y: number; zoom: number };
type FitNode = {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  measured: { width: number; height: number };
  data: Record<string, never>;
};

type FlowFit = {
  setViewport: (viewport: Viewport, options?: { duration?: number }) => Promise<boolean>;
  getNodesBounds: (nodes: FitNode[]) => Rect;
};

export async function fitActiveDocument(flow: FlowFit, options?: { duration?: number; selectionOnly?: boolean }) {
  const state = useEditor.getState();
  const document = state.documents.find((item) => item.id === state.activeId);
  const pane = window.document.querySelector(".react-flow");
  if (!document || !(pane instanceof HTMLElement)) return;
  const rect = pane.getBoundingClientRect();
  if (rect.width < 32 || rect.height < 32) return;
  const selected = new Set(state.selection);
  const nodes = Object.values(document.nodes)
    .filter((node) => isNodeVisible(document, node.id))
    .filter(
      (node) =>
        !options?.selectionOnly ||
        selected.has(node.id) ||
        (!selected.size && node.id === document.rootId),
    )
    .map((node) => ({
      id: node.id,
      position: node.position,
      width: node.width,
      height: node.height,
      measured: { width: node.width, height: node.height },
      data: {},
    }));
  if (!nodes.length) return;
  const bounds = flow.getNodesBounds(nodes);
  const viewport = getViewportForBounds(bounds, rect.width, rect.height, 0.2, 1.15, 0.22);
  await flow.setViewport(viewport, { duration: options?.duration ?? 0 });
}

export async function resetZoomActiveDocument(flow: FlowFit, options?: { duration?: number }) {
  const pane = window.document.querySelector(".react-flow");
  if (!(pane instanceof HTMLElement)) return;
  const rect = pane.getBoundingClientRect();
  const state = useEditor.getState();
  const document = state.documents.find((item) => item.id === state.activeId);
  if (!document) return;
  const root = document.nodes[document.rootId];
  if (!root) return;
  const zoom = 1;
  const x = rect.width / 2 - (root.position.x + root.width / 2) * zoom;
  const y = rect.height / 2 - (root.position.y + root.height / 2) * zoom;
  await flow.setViewport({ x, y, zoom }, { duration: options?.duration ?? 0 });
}
