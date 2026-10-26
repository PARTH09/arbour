"use client";

import {
  captureSubtree,
  childrenOf,
  isNodeVisible,
  nearestInDirection,
  sanitizeHref,
  type MindMapDocument,
  type SubtreeSnapshot,
} from "@arbour/mindmap-core";
import { useReactFlow } from "@xyflow/react";
import { useEffect } from "react";

import { setStyleClipboard, styleClipboard } from "@/features/editor/format-bar";
import { fitActiveDocument, resetZoomActiveDocument } from "@/features/editor/fit-document";
import { useActiveDocument, useEditor } from "@/features/editor/store";

let clipboard: { snapshot: SubtreeSnapshot; outline: string } | null = null;

export function Hotkeys() {
  const document = useActiveDocument();
  const selection = useEditor((state) => state.selection);
  const selectedEdgeId = useEditor((state) => state.selectedEdgeId);
  const dispatch = useEditor((state) => state.dispatch);
  const undo = useEditor((state) => state.undo);
  const redo = useEditor((state) => state.redo);
  const setSelection = useEditor((state) => state.setSelection);
  const startEditing = useEditor((state) => state.startEditing);
  const stopEditing = useEditor((state) => state.stopEditing);
  const setTool = useEditor((state) => state.setTool);
  const setHelpOpen = useEditor((state) => state.setHelpOpen);
  const showGrid = useEditor((state) => state.showGrid);
  const toggleOutline = useEditor((state) => state.toggleOutline);
  const { zoomIn, zoomOut, setViewport, getNodesBounds, screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!document || isTyping(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;

      if (event.key === "Escape") {
        stopEditing();
        setSelection([]);
        setTool("select");
        setHelpOpen(false);
        return;
      }
      if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        event.preventDefault();
        setHelpOpen(true, "shortcuts");
        return;
      }
      if (mod && event.key === "\\") {
        event.preventDefault();
        toggleOutline();
        return;
      }
      if (mod && (event.key === "/" || event.code === "Slash") && event.shiftKey) {
        event.preventDefault();
        const ids = Object.values(document.nodes)
          .filter((node) => childrenOf(document, node.id).length > 0)
          .map((node) => node.id);
        const anyExpanded = ids.some((id) => !document.nodes[id]?.collapsed);
        dispatch({ type: "setCollapsed", ids, collapsed: anyExpanded });
        return;
      }
      if (mod && (event.key === "/" || event.code === "Slash") && !event.shiftKey) {
        event.preventDefault();
        const id = selection[0] ?? document.rootId;
        dispatch({ type: "toggleCollapse", nodeId: id });
        return;
      }
      if (!mod && !event.altKey && event.key.toLowerCase() === "v") {
        event.preventDefault();
        setTool("select");
        return;
      }
      if (!mod && !event.altKey && !event.shiftKey && event.code === "Digit0") {
        event.preventDefault();
        void resetZoomActiveDocument({ setViewport, getNodesBounds }, { duration: 160 });
        return;
      }
      if (!mod && !event.altKey && !event.shiftKey && event.code === "Digit1") {
        event.preventDefault();
        void fitActiveDocument({ setViewport, getNodesBounds }, { duration: 180 });
        return;
      }
      if (!mod && !event.altKey && !event.shiftKey && event.code === "Digit2") {
        event.preventDefault();
        void fitActiveDocument({ setViewport, getNodesBounds }, { duration: 180, selectionOnly: true });
        return;
      }
      if (event.code === "Digit1" && event.shiftKey && !mod) {
        event.preventDefault();
        void fitActiveDocument({ setViewport, getNodesBounds }, { duration: 180 });
        return;
      }
      if ((event.key === "+" || event.key === "=") && !mod) {
        event.preventDefault();
        zoomIn({ duration: 120 });
        return;
      }
      if ((event.key === "-" || event.key === "_") && !mod) {
        event.preventDefault();
        zoomOut({ duration: 120 });
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        return;
      }
      if (event.key === "Tab" && event.shiftKey) {
        event.preventDefault();
        const id = selection[0] ?? document.rootId;
        dispatch({ type: "promote", nodeId: id });
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        const parentId = selection[0] && document.nodes[selection[0]] ? selection[0] : document.rootId;
        dispatch({ type: "addChild", parentId }, { edit: true });
        return;
      }
      if (event.key === "Enter" && event.altKey && !mod) {
        event.preventDefault();
        const id = selection[0];
        if (id) dispatch({ type: "addParent", nodeId: id }, { edit: true });
        return;
      }
      if (event.key === "Enter" && mod) {
        event.preventDefault();
        const id = selection[0];
        if (id) dispatch({ type: "addSibling", nodeId: id, placement: "above" }, { edit: true });
        else dispatch({ type: "addChild", parentId: document.rootId }, { edit: true });
        return;
      }
      if (event.key === "Enter" && !mod) {
        event.preventDefault();
        const id = selection[0];
        if (id) dispatch({ type: "addSibling", nodeId: id }, { edit: true });
        else dispatch({ type: "addChild", parentId: document.rootId }, { edit: true });
        return;
      }
      if (event.key === "F2" && selection[0]) {
        event.preventDefault();
        startEditing(selection[0], true);
        return;
      }
      if ((event.key === "Backspace" || event.key === "Delete") && !mod) {
        event.preventDefault();
        if (selectedEdgeId) {
          dispatch({ type: "deleteEdges", ids: [selectedEdgeId] });
          return;
        }
        if (selection.length) dispatch({ type: "deleteNodes", ids: selection });
        return;
      }
      if (mod && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      if (mod && ((event.key.toLowerCase() === "z" && event.shiftKey) || event.key.toLowerCase() === "y")) {
        event.preventDefault();
        redo();
        return;
      }
      if (mod && event.key.toLowerCase() === "d") {
        event.preventDefault();
        if (selection[0]) dispatch({ type: "duplicate", nodeId: selection[0] });
        return;
      }
      if (mod && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setSelection(Object.values(document.nodes).filter((node) => isNodeVisible(document, node.id)).map((node) => node.id));
        return;
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === "u") {
        event.preventDefault();
        const id = selection[0];
        if (!id || !document.nodes[id]) return;
        const current = document.nodes[id].href ?? "";
        const next = window.prompt("Add a link (https://… or leave blank to clear)", current);
        if (next == null) return;
        dispatch({ type: "patchNodes", ids: [id], href: sanitizeHref(next.trim() || null) });
        return;
      }
      if (mod && event.altKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        const id = selection[0];
        const node = id ? document.nodes[id] : null;
        if (!node) return;
        setStyleClipboard({ style: { ...node.style, themeLock: true }, emoji: node.emoji || undefined });
        return;
      }
      if (mod && event.altKey && event.key.toLowerCase() === "v") {
        event.preventDefault();
        if (!styleClipboard || !selection.length) return;
        dispatch({
          type: "patchNodes",
          ids: selection,
          style: styleClipboard.style,
          emoji: styleClipboard.emoji,
        });
        return;
      }
      if (mod && event.key.toLowerCase() === "c") {
        const id = selection[0];
        const snapshot = id ? captureSubtree(document, id) : null;
        if (!snapshot) return;
        const outline = outlineFrom(document, id);
        clipboard = { snapshot, outline };
        void navigator.clipboard?.writeText(outline).catch(() => undefined);
        return;
      }
      if (mod && event.key.toLowerCase() === "v" && event.shiftKey) {
        event.preventDefault();
        void pasteOutlineOnly(selection[0] ?? document.rootId);
        return;
      }
      if (mod && event.key.toLowerCase() === "v") {
        event.preventDefault();
        void paste(document, selection[0] ?? document.rootId);
        return;
      }
      if (!mod && !event.altKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        const position = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        dispatch(
          {
            type: "addFloating",
            position: { x: position.x - 40, y: position.y - 20 },
            text: "New topic",
          },
          { edit: true },
        );
        return;
      }
      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        const id = selection[0] ?? document.rootId;
        const direction = event.key.replace("Arrow", "").toLowerCase() as "left" | "right" | "up" | "down";
        if (event.shiftKey) {
          const step = showGrid ? 22 : 12;
          const dx = direction === "left" ? -step : direction === "right" ? step : 0;
          const dy = direction === "up" ? -step : direction === "down" ? step : 0;
          dispatch({ type: "nudge", nodeId: id, dx, dy });
          return;
        }
        const next = nearestInDirection(document, id, direction);
        if (next) setSelection([next]);
        return;
      }
      if (!mod && !event.altKey && event.key.length === 1 && selection.length === 1) {
        event.preventDefault();
        dispatch({ type: "rename", nodeId: selection[0], text: event.key }, { coalesceKey: `rename:${selection[0]}`, edit: true, selectAll: false });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    dispatch,
    document,
    getNodesBounds,
    redo,
    screenToFlowPosition,
    selectedEdgeId,
    selection,
    setSelection,
    setHelpOpen,
    setTool,
    setViewport,
    showGrid,
    startEditing,
    stopEditing,
    toggleOutline,
    undo,
    zoomIn,
    zoomOut,
  ]);

  return null;
}

async function paste(document: MindMapDocument, parentId: string) {
  let text = "";
  try {
    text = await navigator.clipboard.readText();
  } catch {
    text = "";
  }
  const dispatch = useEditor.getState().dispatch;
  if (clipboard && (!text.trim() || text.trim() === clipboard.outline.trim())) {
    dispatch({ type: "pasteSubtree", parentId, snapshot: clipboard.snapshot });
    return;
  }
  if (text.trim()) dispatch({ type: "pasteOutline", parentId, outline: text });
  else if (clipboard) dispatch({ type: "pasteSubtree", parentId, snapshot: clipboard.snapshot });
}

async function pasteOutlineOnly(parentId: string) {
  let text = "";
  try {
    text = await navigator.clipboard.readText();
  } catch {
    text = "";
  }
  const dispatch = useEditor.getState().dispatch;
  if (text.trim()) {
    dispatch({ type: "pasteOutline", parentId, outline: text });
    return;
  }
  if (clipboard?.outline.trim()) {
    dispatch({ type: "pasteOutline", parentId, outline: clipboard.outline });
  }
}

function outlineFrom(document: MindMapDocument, id: string) {
  const lines: string[] = [];
  const walk = (nodeId: string, depth: number) => {
    const node = document.nodes[nodeId];
    if (!node) return;
    lines.push(`${"  ".repeat(depth)}${node.text}`);
    for (const child of childrenOf(document, nodeId)) walk(child.id, depth + 1);
  };
  walk(id, 0);
  return lines.join("\n");
}

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}
