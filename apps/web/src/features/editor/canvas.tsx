"use client";

import {
  captureSubtree,
  childrenOf,
  connectorHandles,
  findDropTarget,
  isNodeVisible,
  subtreeIds,
  type MindMapDocument,
  type MindNode,
} from "@arbour/mindmap-core";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  PanOnScrollMode,
  ReactFlow,
  ViewportPortal,
  useReactFlow,
  type Connection,
  type OnNodeDrag,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "@xyflow/react/dist/style.css";

import { BranchEdge, type BranchFlowEdge } from "@/features/editor/branch-edge";
import { exportActiveDocument } from "@/features/editor/export-document";
import { fitActiveDocument } from "@/features/editor/fit-document";
import { useActiveDocument, useDocumentAccess, useEditor } from "@/features/editor/store";
import { TopicNode, type TopicFlowNode } from "@/features/editor/topic-node";

const nodeTypes = { topic: TopicNode };
const edgeTypes = { branch: BranchEdge };

export function Canvas() {
  const document = useActiveDocument();
  const selection = useEditor((state) => state.selection);
  const selectedEdgeId = useEditor((state) => state.selectedEdgeId);
  const tool = useEditor((state) => state.tool);
  const access = useDocumentAccess();
  const showGrid = useEditor((state) => state.showGrid);
  const showMinimap = useEditor((state) => state.showMinimap);
  const theme = useEditor((state) => state.theme);
  const viewport = useEditor((state) => (document ? state.viewports[document.id] : undefined));
  const dispatch = useEditor((state) => state.dispatch);
  const setSelection = useEditor((state) => state.setSelection);
  const selectEdge = useEditor((state) => state.selectEdge);
  const setViewport = useEditor((state) => state.setViewport);
  const setZoom = useEditor((state) => state.setZoom);
  const startEditing = useEditor((state) => state.startEditing);
  const stopEditing = useEditor((state) => state.stopEditing);
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const [menu, setMenu] = useState<{ x: number; y: number; nodeId?: string } | null>(null);
  const dragOrigin = useRef<{ id: string; x: number; y: number; positions: Record<string, { x: number; y: number }> } | null>(null);
  const { setViewport: setFlowViewport, getNodesBounds } = useReactFlow();
  const setFlowViewportRef = useRef(setFlowViewport);
  const getNodesBoundsRef = useRef(getNodesBounds);
  setFlowViewportRef.current = setFlowViewport;
  getNodesBoundsRef.current = getNodesBounds;
  const userNavigated = useRef(false);
  const fittedDocument = useRef<string | null>(null);
  const shouldFit = useRef(false);
  const fitAttempts = useRef(0);
  if (document && fittedDocument.current !== document.id) {
    fittedDocument.current = document.id;
    const saved = useEditor.getState().viewports[document.id];
    const untouched = !saved || (saved.x === 0 && saved.y === 0 && saved.zoom === 1);
    shouldFit.current = untouched;
    userNavigated.current = false;
    fitAttempts.current = 0;
  }
  const layoutKey = document
    ? Object.values(document.nodes)
        .map((node) => `${node.id}:${Math.round(node.position.x)}:${Math.round(node.position.y)}:${node.width}x${node.height}`)
        .join("|")
    : "";

  useEffect(() => {
    if (!shouldFit.current || userNavigated.current || fitAttempts.current >= 5) return;
    const timer = window.setTimeout(() => {
      if (!shouldFit.current || userNavigated.current) return;
      fitAttempts.current += 1;
      if (fitAttempts.current >= 5) shouldFit.current = false;
      void fitActiveDocument(
        { setViewport: setFlowViewportRef.current, getNodesBounds: getNodesBoundsRef.current },
        { duration: 0 },
      );
    }, 90);
    return () => window.clearTimeout(timer);
  }, [layoutKey]);

  const nodes = useMemo<TopicFlowNode[]>(() => {
    if (!document) return [];
    return Object.values(document.nodes)
      .filter((node) => isNodeVisible(document, node.id))
      .map((node) => ({
        id: node.id,
        type: "topic",
        position: dragPositions[node.id] ?? node.position,
        measured: { width: node.width, height: node.height },
        initialWidth: node.width,
        initialHeight: node.height,
        data: {
          node,
          childCount: childrenOf(document, node.id).length,
          dropTarget: dropTarget === node.id,
          chevron: chevronFor(document, node),
          connecting: tool === "connect",
        },
        selected: selection.includes(node.id),
        draggable: access.canEdit && tool === "select" && node.id !== document.rootId,
        selectable: tool !== "pan",
      }));
  }, [access.canEdit, document, dragPositions, dropTarget, selection, tool]);

  const edges = useMemo<BranchFlowEdge[]>(() => {
    if (!document) return [];
    // Only force right-side handles for pure left→right maps. Balanced welcome maps
    // must pick handles from each branch side or left leaves grow outer stubs.
    const preferRight = edgeKindTreeRight(document.layout.orientation);
    return Object.values(document.edges)
      .filter((edge) => isNodeVisible(document, edge.sourceId) && isNodeVisible(document, edge.targetId))
      .map((edge) => {
        const source = positioned(document.nodes[edge.sourceId], dragPositions);
        const target = positioned(document.nodes[edge.targetId], dragPositions);
        const handles = connectorHandles(source, target, {
          preferRight: edge.kind === "tree" && preferRight,
          layout: document.layout.orientation,
        });
        return {
          id: edge.id,
          source: edge.sourceId,
          target: edge.targetId,
          sourceHandle: handles.sourceHandle,
          targetHandle: handles.targetHandle,
          type: "branch",
          selected: edge.id === selectedEdgeId,
          data: {
            edge,
            color: edge.style.followNode ? target.style.borderColor : edge.style.stroke,
          },
        };
      });
  }, [document, dragPositions, selectedEdgeId]);

  const onNodeDragStart = useCallback<OnNodeDrag<TopicFlowNode>>((_, node) => {
    if (!document) return;
    const positions: Record<string, { x: number; y: number }> = {};
    for (const id of subtreeIds(document, node.id)) {
      const topic = document.nodes[id];
      if (topic) positions[id] = { ...topic.position };
    }
    dragOrigin.current = { id: node.id, x: node.position.x, y: node.position.y, positions };
  }, [document]);

  const onNodeDrag = useCallback<OnNodeDrag<TopicFlowNode>>((event, node) => {
    const origin = dragOrigin.current;
    if (!document || !origin) return;
    const dx = node.position.x - origin.x;
    const dy = node.position.y - origin.y;
    const next: Record<string, { x: number; y: number }> = {};
    for (const [id, point] of Object.entries(origin.positions)) {
      next[id] = { x: point.x + dx, y: point.y + dy };
    }
    setDragPositions(next);
    const dragged = document.nodes[node.id];
    if (!dragged) return;
    const center = { x: node.position.x + dragged.width / 2, y: node.position.y + dragged.height / 2 };
    setDropTarget(event.altKey ? null : findDropTarget(document, node.id, center));
    if (event.altKey || dragged.floating) {
      const guide = alignmentGuide(document, node.id, center);
      setGuides(guide);
    } else {
      setGuides({});
    }
  }, [document]);

  const onNodeDragStop = useCallback<OnNodeDrag<TopicFlowNode>>((event, node) => {
    const origin = dragOrigin.current;
    dragOrigin.current = null;
    setDragPositions({});
    setDropTarget(null);
    setGuides({});
    if (!document || !origin) return;
    const dragged = document.nodes[node.id];
    if (!dragged || dragged.id === document.rootId) return;
    let x = node.position.x;
    let y = node.position.y;
    const center = { x: x + dragged.width / 2, y: y + dragged.height / 2 };
    const guide: { x?: number; y?: number } =
      event.altKey || dragged.floating ? alignmentGuide(document, node.id, center) : {};
    if (guide.x != null) x += guide.x - center.x;
    if (guide.y != null) y += guide.y - center.y;
    if (showGrid && (event.altKey || dragged.floating)) {
      x = Math.round(x / 22) * 22;
      y = Math.round(y / 22) * 22;
    }
    // Option/Alt-drag duplicates in place; original snaps back from store.
    if (event.altKey && !dragged.floating) {
      const snapshot = captureSubtree(document, node.id);
      if (snapshot) {
        dispatch({ type: "pasteSubtree", parentId: null, snapshot, position: { x, y } });
      }
      return;
    }
    const target = findDropTarget(document, node.id, { x: x + dragged.width / 2, y: y + dragged.height / 2 });
    if (target) {
      const root = document.nodes[document.rootId];
      const side = center.x < root.position.x + root.width / 2 ? "left" : "right";
      dispatch({
        type: "reparent",
        nodeId: node.id,
        parentId: target,
        side: target === document.rootId ? side : undefined,
      });
      return;
    }
    if (dragged.floating) {
      dispatch({ type: "moveFloating", nodeId: node.id, position: { x, y } });
      return;
    }
    if (dragged.parentId) {
      const siblings = childrenOf(document, dragged.parentId);
      const ranked = siblings
        .map((sibling) => ({ id: sibling.id, y: sibling.id === node.id ? y : sibling.position.y }))
        .sort((a, b) => a.y - b.y);
      const nextIndex = ranked.findIndex((sibling) => sibling.id === node.id);
      const currentIndex = siblings.findIndex((sibling) => sibling.id === node.id);
      if (nextIndex !== currentIndex && nextIndex >= 0) {
        dispatch({ type: "reorder", nodeId: node.id, index: nextIndex });
      }
    }
  }, [dispatch, document, showGrid]);

  const handleSelectionChange = useCallback(({ nodes: selected }: { nodes: { id: string }[] }) => {
    setSelection(selected.map((node) => node.id));
  }, [setSelection]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    dispatch({ type: "addLink", sourceId: connection.source, targetId: connection.target });
  }, [dispatch]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  if (!document) return null;
  const savedViewport = viewport;

  return (
    <div className="h-full w-full" data-testid="mindmap-canvas">
      <ReactFlow
        key={document.id}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={savedViewport ?? { x: 0, y: 0, zoom: 1 }}
        fitView={false}
        minZoom={0.2}
        maxZoom={2}
        colorMode={theme}
        onlyRenderVisibleElements
        nodesDraggable={access.canEdit && tool === "select"}
        nodesConnectable={access.canEdit && tool === "connect"}
        elementsSelectable={tool !== "pan"}
        selectionOnDrag={tool === "select"}
        panOnDrag={tool === "pan" ? true : [1, 2]}
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        zoomOnScroll={false}
        panActivationKeyCode="Space"
        multiSelectionKeyCode="Shift"
        deleteKeyCode={null}
        zoomOnDoubleClick={false}
        zoomOnPinch
        connectionMode={ConnectionMode.Loose}
        proOptions={{ hideAttribution: false }}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onSelectionChange={handleSelectionChange}
        onPaneClick={() => {
          setSelection([]);
          selectEdge(null);
          stopEditing();
          setMenu(null);
        }}
        onNodeDoubleClick={(_, node) => startEditing(node.id, true)}
        onEdgeClick={(event, edge) => {
          event.stopPropagation();
          selectEdge(edge.id);
        }}
        onPaneContextMenu={(event) => {
          event.preventDefault();
          setMenu({ x: event.clientX, y: event.clientY });
        }}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          setSelection([node.id]);
          setMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
        }}
        onMove={(event, next) => {
          if (isUserViewportEvent(event)) {
            userNavigated.current = true;
            shouldFit.current = false;
          }
          setZoom(next.zoom);
        }}
        onMoveEnd={(event, next) => {
          if (isUserViewportEvent(event)) {
            userNavigated.current = true;
            shouldFit.current = false;
          }
          if (shouldFit.current) return;
          const saved = useEditor.getState().viewports[document.id];
          const identity = next.x === 0 && next.y === 0 && next.zoom === 1;
          const savedIsFramed = !!saved && !(saved.x === 0 && saved.y === 0 && saved.zoom === 1);
          if (identity && savedIsFramed && !isUserViewportEvent(event)) return;
          setViewport(document.id, next);
        }}
      >
        {showGrid ? <Background variant={BackgroundVariant.Dots} gap={22} size={1.15} color="var(--arbour-grid)" /> : null}
        {showMinimap ? (
          <MiniMap
            pannable
            zoomable
            position="bottom-left"
            maskColor={theme === "dark" ? "rgba(0,0,0,0.45)" : "rgba(28,25,23,0.08)"}
            bgColor={theme === "dark" ? "#22231f" : "#fff"}
            nodeStrokeWidth={0}
            nodeColor={(flowNode) => {
              const topic = (flowNode.data as TopicFlowNode["data"] | undefined)?.node;
              return topic?.style.borderColor || "#0f6e56";
            }}
            className="!m-3 overflow-hidden rounded-xl border border-line shadow-sm"
          />
        ) : null}
        <ViewportPortal>
          <svg className="pointer-events-none overflow-visible">
            {guides.x != null ? (
              <line x1={guides.x} y1={-8000} x2={guides.x} y2={8000} stroke="var(--arbour-accent)" strokeDasharray="4 4" />
            ) : null}
            {guides.y != null ? (
              <line x1={-8000} y1={guides.y} x2={8000} y2={guides.y} stroke="var(--arbour-accent)" strokeDasharray="4 4" />
            ) : null}
          </svg>
        </ViewportPortal>
      </ReactFlow>
      {dropTarget ? (
        <p className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-xs text-panel">
          Drop to attach this topic
        </p>
      ) : null}
      {menu ? (
        <CanvasMenu
          menu={menu}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  );
}

function CanvasMenu({ menu, onClose }: { menu: { x: number; y: number; nodeId?: string }; onClose: () => void }) {
  const document = useActiveDocument();
  const dispatch = useEditor((state) => state.dispatch);
  const setSelection = useEditor((state) => state.setSelection);
  const startEditing = useEditor((state) => state.startEditing);
  const access = useDocumentAccess();
  if (!document) return null;
  const node = menu.nodeId ? document.nodes[menu.nodeId] : undefined;
  const items: { label: string; action: () => void; danger?: boolean }[] = !access.canEdit
    ? node
      ? []
      : [
          { label: "Export as JSON", action: () => void exportActiveDocument("json") },
          {
            label: "Select all",
            action: () => setSelection(Object.values(document.nodes).filter((item) => isNodeVisible(document, item.id)).map((item) => item.id)),
          },
        ]
    : node
    ? [
        { label: "Add child", action: () => dispatch({ type: "addChild", parentId: node.id }, { edit: true }) },
        { label: "Add sibling", action: () => dispatch({ type: "addSibling", nodeId: node.id }, { edit: true }) },
        { label: "Add sibling above", action: () => dispatch({ type: "addSibling", nodeId: node.id, placement: "above" }, { edit: true }) },
        ...(node.id !== document.rootId
          ? [{ label: "Add parent", action: () => dispatch({ type: "addParent", nodeId: node.id }, { edit: true }) }]
          : []),
        { label: "Duplicate", action: () => dispatch({ type: "duplicate", nodeId: node.id }) },
        ...(node.id !== document.rootId
          ? [{ label: "Move under…", action: () => useEditor.getState().setMoveNodeId(node.id) }]
          : []),
        ...(node.id !== document.rootId && !node.floating
          ? [{
              label: "Detach",
              action: () =>
                dispatch({
                  type: "moveFloating",
                  nodeId: node.id,
                  position: { x: node.position.x + 48, y: node.position.y + 48 },
                }),
            }]
          : []),
        ...(childrenOf(document, node.id).length
          ? [{ label: node.collapsed ? "Expand branch" : "Collapse branch", action: () => dispatch({ type: "toggleCollapse", nodeId: node.id }) }]
          : []),
        ...(node.parentId === document.rootId
          ? [{
              label: node.side === "left" ? "Move branch right" : "Move branch left",
              action: () => dispatch({ type: "setSide", nodeId: node.id, side: node.side === "left" ? "right" : "left" }),
            }]
          : []),
        { label: "Rename", action: () => startEditing(node.id, true) },
        { label: "Delete", action: () => dispatch({ type: "deleteNodes", ids: [node.id] }), danger: true },
      ]
    : [
        {
          label: "Add detached topic",
          action: () => {
            const root = document.nodes[document.rootId];
            dispatch({
              type: "addFloating",
              position: { x: root.position.x + root.width + 120, y: root.position.y + 180 },
              text: "Detached topic",
            }, { edit: true });
          },
        },
        { label: "Tidy layout", action: () => dispatch({ type: "relayout" }) },
        { label: "Export as JSON", action: () => void exportActiveDocument("json") },
        {
          label: "Select all",
          action: () => setSelection(Object.values(document.nodes).filter((item) => isNodeVisible(document, item.id)).map((item) => item.id)),
        },
      ];

  if (!items.length) return null;

  return (
    <div
      role="menu"
      className="fixed z-50 min-w-44 rounded-xl border border-line bg-panel p-1 text-sm shadow-lg"
      style={{ left: menu.x, top: menu.y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={`block w-full rounded-lg px-2.5 py-1.5 text-left hover:bg-accent-soft ${item.danger ? "text-danger" : ""}`}
          onClick={() => {
            item.action();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function isUserViewportEvent(event: MouseEvent | TouchEvent | null) {
  return !!event && (event.type === "wheel" || event.type === "pointermove" || event.type === "mousemove" || event.type === "touchmove");
}

function positioned(node: MindNode, overrides: Record<string, { x: number; y: number }>): MindNode {
  const position = overrides[node.id];
  return position ? { ...node, position } : node;
}

function edgeKindTreeRight(orientation: MindMapDocument["layout"]["orientation"]): boolean {
  return orientation === "right";
}

function chevronFor(document: MindMapDocument, node: MindNode): "left" | "right" | "up" | "down" {
  if (document.layout.orientation === "down") return "down";
  if (document.layout.orientation === "up") return "up";
  if (document.layout.orientation === "left") return "left";
  if (document.layout.orientation === "right") return "right";
  if (document.layout.orientation === "radial") {
    const root = document.nodes[document.rootId];
    const dx = node.position.x + node.width / 2 - (root.position.x + root.width / 2);
    const dy = node.position.y + node.height / 2 - (root.position.y + root.height / 2);
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
    return dy >= 0 ? "down" : "up";
  }
  let current = node;
  while (current.parentId && current.parentId !== document.rootId) {
    const parent = document.nodes[current.parentId];
    if (!parent) break;
    current = parent;
  }
  return current.side === "left" ? "left" : "right";
}

function alignmentGuide(document: MindMapDocument, draggedId: string, center: { x: number; y: number }) {
  let x: number | undefined;
  let y: number | undefined;
  for (const node of Object.values(document.nodes)) {
    if (node.id === draggedId || !isNodeVisible(document, node.id)) continue;
    const other = { x: node.position.x + node.width / 2, y: node.position.y + node.height / 2 };
    if (x == null && Math.abs(center.x - other.x) < 6) x = other.x;
    if (y == null && Math.abs(center.y - other.y) < 6) y = other.y;
  }
  return { x, y };
}
