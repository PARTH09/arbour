"use client";

import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { ChevronRight, Link2, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { fontStack, NODE_METRICS, parseMapHref, type MindNode } from "@arbour/mindmap-core";
import { cn } from "@/lib/utils";
import { useDocumentAccess, useEditor } from "@/features/editor/store";

export type TopicFlowNode = Node<
  {
    node: MindNode;
    childCount: number;
    dropTarget: boolean;
    chevron: "left" | "right" | "up" | "down";
    connecting: boolean;
  },
  "topic"
>;

const handleClass =
  "!h-2.5 !w-2.5 !border-2 !border-panel !bg-accent !opacity-0 transition-opacity group-hover:!opacity-100";

export function TopicNode({ id, data, selected }: NodeProps<TopicFlowNode>) {
  const node = data.node;
  const editing = useEditor((state) => state.editingId === id);
  const editSelectAll = useEditor((state) => state.editSelectAll);
  const dispatch = useEditor((state) => state.dispatch);
  const stopEditing = useEditor((state) => state.stopEditing);
  const startEditing = useEditor((state) => state.startEditing);
  const openDocument = useEditor((state) => state.openDocument);
  const documents = useEditor((state) => state.documents);
  const access = useDocumentAccess();
  const [draft, setDraft] = useState(node.text);
  const field = useRef<HTMLTextAreaElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const original = useRef(node.text);
  const mapTargetId = parseMapHref(node.href);
  const mapTarget = mapTargetId ? documents.find((document) => document.id === mapTargetId) : null;

  useEffect(() => {
    if (!editing) {
      setDraft(node.text);
      original.current = node.text;
    }
  }, [editing, node.text]);

  useEffect(() => {
    const element = body.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      useEditor.getState().measureNode(id, element.offsetWidth, element.offsetHeight);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [id]);

  useEffect(() => {
    if (!editing || !field.current) return;
    field.current.focus();
    const length = field.current.value.length;
    field.current.setSelectionRange(editSelectAll ? 0 : length, editSelectAll ? length : length);
  }, [editing, editSelectAll]);

  const style = node.style;
  const underline = style.shape === "underline";
  const borderless = style.shape === "borderless" || underline;
  const radius =
    style.shape === "pill" ? 999 : style.shape === "ellipse" ? 999 : style.shape === "rectangle" ? 4 : 14;
  const sideWidth = borderless ? 0 : style.borderWidth;
  const label = `${node.emoji ? `${node.emoji} ` : ""}${node.text}`;
  const showAdd = access.canEdit && !editing && !data.connecting;

  return (
    <div className="group relative" role="group" aria-label={`${node.text} topic`} data-testid="topic" data-topic-text={node.text}>
      <Handle id="target-left" type="target" position={Position.Left} className="!h-4 !w-4 !border-0 !bg-transparent !opacity-0" />
      <Handle id="target-right" type="target" position={Position.Right} className="!h-4 !w-4 !border-0 !bg-transparent !opacity-0" />
      <Handle id="target-top" type="target" position={Position.Top} className="!h-4 !w-4 !border-0 !bg-transparent !opacity-0" />
      <Handle id="target-bottom" type="target" position={Position.Bottom} className="!h-4 !w-4 !border-0 !bg-transparent !opacity-0" />
      <div
        ref={body}
        role="button"
        tabIndex={-1}
        className={cn("relative text-center", selected && "z-10")}
        style={{
          maxWidth: (node.nodeType === "note" ? NODE_METRICS.noteMaxTextWidth : NODE_METRICS.maxTextWidth) + NODE_METRICS.paddingX * 2,
          minWidth: NODE_METRICS.minWidth,
          padding: `${NODE_METRICS.paddingY}px ${NODE_METRICS.paddingX}px`,
          background: borderless ? "transparent" : style.background,
          color: style.color,
          borderStyle: underline ? "solid" : borderless ? "none" : style.borderStyle,
          borderTopWidth: sideWidth,
          borderRightWidth: sideWidth,
          borderBottomWidth: underline ? 1.5 : sideWidth,
          borderLeftWidth: sideWidth,
          borderColor: style.borderColor,
          borderRadius: borderless ? 0 : radius,
          opacity: style.opacity,
          fontFamily: fontStack(style.fontFamily),
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          textDecoration: style.textDecoration,
          textAlign: style.textAlign,
          lineHeight: NODE_METRICS.lineHeight,
          boxShadow: data.dropTarget
            ? "0 0 0 3px var(--arbour-accent)"
            : selected
              ? "0 0 0 2px var(--arbour-canvas), 0 0 0 4px var(--arbour-accent)"
              : !borderless && style.shadow === "soft"
                ? "0 1px 2px rgba(28,25,23,0.06), 0 8px 18px rgba(28,25,23,0.05)"
                : "none",
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          startEditing(id, true);
        }}
        aria-label={`${node.text} topic`}
      >
        {node.imageUrl ? (
          // External image URLs are validated as http(s) before they are stored.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={node.imageUrl}
            alt=""
            className="mb-2 max-h-28 w-full rounded-md object-cover"
            draggable={false}
            referrerPolicy="no-referrer"
          />
        ) : null}
        {editing ? (
          <textarea
            ref={field}
            value={draft}
            rows={Math.min(6, Math.max(1, draft.split("\n").length))}
            aria-label={`Edit ${node.text}`}
            className="nodrag nopan nowheel w-full resize-none bg-transparent text-inherit outline-none"
            style={{ textAlign: style.textAlign, font: "inherit" }}
            onChange={(event) => {
              const value = event.target.value;
              setDraft(value);
              dispatch({ type: "rename", nodeId: id, text: value }, { coalesceKey: `rename:${id}` });
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                dispatch(
                  { type: "rename", nodeId: id, text: original.current },
                  { coalesceKey: `rename:${id}` },
                );
                stopEditing();
              } else if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                dispatch({ type: "addSibling", nodeId: id }, { edit: true, selectAll: true });
              } else if (event.key === "Tab" && !event.shiftKey) {
                event.preventDefault();
                dispatch({ type: "addChild", parentId: id }, { edit: true, selectAll: true });
              } else if (event.key === "Tab" && event.shiftKey) {
                event.preventDefault();
                stopEditing();
                dispatch({ type: "promote", nodeId: id });
              }
            }}
            onBlur={() => {
              if (useEditor.getState().editingId === id) stopEditing();
            }}
            onPointerDown={(event) => event.stopPropagation()}
          />
        ) : (
          <div className="whitespace-pre-wrap break-words">{label}</div>
        )}
        {node.note ? (
          <p className="mt-1 text-left text-[12px] leading-snug opacity-75">{node.note}</p>
        ) : null}
        {node.tags.length ? (
          <div className="mt-1.5 flex flex-wrap justify-center gap-1">
            {node.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] tracking-wide uppercase">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        {node.href ? (
          mapTargetId ? (
            <button
              type="button"
              className="nodrag nopan mt-1 inline-flex max-w-full items-center gap-1 text-[11px] underline"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                openDocument(mapTargetId);
              }}
            >
              <Link2 size={11} className="shrink-0" />
              <span className="truncate">{mapTarget?.title || "Open map"}</span>
            </button>
          ) : (
            <a
              href={node.href}
              target="_blank"
              rel="noreferrer"
              className="nodrag nopan mt-1 inline-flex max-w-full items-center gap-1 text-[11px] underline"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <Link2 size={11} className="shrink-0" />
              <span className="truncate">Link</span>
            </a>
          )
        ) : null}
      </div>
      {showAdd ? (
        <>
          <button
            type="button"
            className={cn(
              "nodrag nopan absolute z-20 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-panel text-muted opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-accent hover:text-white focus-visible:opacity-100",
              selected && "opacity-100",
            )}
            style={{
              right: data.childCount > 0 && data.chevron === "right" ? -30 : -12,
              top: "50%",
              transform: "translateY(-50%)",
            }}
            aria-label="Add child topic"
            title="Add child"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              dispatch({ type: "addChild", parentId: id }, { edit: true, selectAll: true });
            }}
          >
            <Plus size={12} />
          </button>
          <button
            type="button"
            className={cn(
              "nodrag nopan absolute z-20 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-panel text-muted opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-accent hover:text-white focus-visible:opacity-100",
              selected && "opacity-100",
            )}
            style={{
              left: "50%",
              bottom: data.childCount > 0 && data.chevron === "down" ? -30 : -12,
              transform: "translateX(-50%)",
            }}
            aria-label="Add sibling topic"
            title="Add sibling"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              dispatch({ type: "addSibling", nodeId: id }, { edit: true, selectAll: true });
            }}
          >
            <Plus size={12} />
          </button>
        </>
      ) : null}
      {data.childCount > 0 ? (
        <button
          type="button"
          className="nodrag nopan absolute z-10 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-panel text-muted shadow-sm hover:text-ink"
          style={{
            left: data.chevron === "left" ? -12 : data.chevron === "up" || data.chevron === "down" ? "50%" : undefined,
            right: data.chevron === "right" ? -12 : undefined,
            top: data.chevron === "up" ? -12 : data.chevron === "left" || data.chevron === "right" ? "50%" : undefined,
            bottom: data.chevron === "down" ? -12 : undefined,
            transform:
              data.chevron === "left" || data.chevron === "right" ? "translateY(-50%)" : "translateX(-50%)",
          }}
          aria-label={node.collapsed ? "Expand branch" : "Collapse branch"}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            dispatch({ type: "toggleCollapse", nodeId: id });
          }}
        >
          <ChevronRight
            size={12}
            style={{
              transform: `rotate(${{ right: 0, down: 90, left: 180, up: -90 }[data.chevron]}deg)`,
            }}
          />
          {node.collapsed ? (
            <span className="sr-only">{data.childCount}</span>
          ) : null}
        </button>
      ) : null}
      {node.collapsed && data.childCount > 0 ? (
        <span className="pointer-events-none absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-muted">
          {data.childCount}
        </span>
      ) : null}
      <Handle id="source-left" type="source" position={Position.Left} className={cn(handleClass, data.connecting && "!opacity-100")} />
      <Handle id="source-right" type="source" position={Position.Right} className={cn(handleClass, data.connecting && "!opacity-100")} />
      <Handle id="source-top" type="source" position={Position.Top} className={cn(handleClass, data.connecting && "!opacity-100")} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} className={cn(handleClass, data.connecting && "!opacity-100")} />
    </div>
  );
}
