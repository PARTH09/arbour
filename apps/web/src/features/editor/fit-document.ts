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

export async function fitActiveDocument(flow: FlowFit, options?: { duration?: number }) {
  const state = useEditor.getState();
  const document = state.documents.find((item) => item.id === state.activeId);
  const pane = window.document.querySelector(".react-flow");
  if (!document || !(pane instanceof HTMLElement)) return;
  const rect = pane.getBoundingClientRect();
  if (rect.width < 32 || rect.height < 32) return;
  const nodes = Object.values(document.nodes)
    .filter((node) => isNodeVisible(document, node.id))
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
