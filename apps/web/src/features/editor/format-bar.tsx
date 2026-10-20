"use client";

import {
  FONT_OPTIONS,
  PALETTE,
  type EdgeStyle,
  type NodeShape,
  type NodeStyle,
} from "@arbour/mindmap-core";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Underline } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useActiveDocument, useDocumentAccess, useEditor } from "@/features/editor/store";

const SHAPES: { id: NodeShape; label: string }[] = [
  { id: "rounded", label: "Rounded" },
  { id: "rectangle", label: "Rectangle" },
  { id: "pill", label: "Pill" },
  { id: "ellipse", label: "Ellipse" },
  { id: "underline", label: "Underline" },
  { id: "borderless", label: "Borderless" },
];

export function FormatBar() {
  const document = useActiveDocument();
  const selection = useEditor((state) => state.selection);
  const selectedEdgeId = useEditor((state) => state.selectedEdgeId);
  const dispatch = useEditor((state) => state.dispatch);
  const access = useDocumentAccess();
  const [details, setDetails] = useState(false);
  if (!document || !access.canEdit) return null;
  const edge = selectedEdgeId ? document.edges[selectedEdgeId] : undefined;
  const nodes = selection.map((id) => document.nodes[id]).filter(Boolean);
  if (!nodes.length && !edge) return null;

  if (edge && !nodes.length) {
    const patch = (style: Partial<EdgeStyle>) => dispatch({ type: "patchEdges", ids: [edge.id], style });
    return (
      <div className="absolute top-3 left-1/2 z-20 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center gap-1 rounded-2xl border border-line bg-panel px-2 py-1.5 shadow-lg">
        {(["bezier", "straight", "orthogonal"] as const).map((path) => (
          <BarButton key={path} active={edge.style.path === path} onClick={() => patch({ path })}>
            {path === "bezier" ? "Curve" : path === "straight" ? "Line" : "Elbow"}
          </BarButton>
        ))}
        <Swatches value={edge.style.stroke} onChange={(stroke) => patch({ stroke })} />
        <BarButton active={edge.style.lineStyle === "dashed"} onClick={() => patch({ lineStyle: edge.style.lineStyle === "dashed" ? "solid" : "dashed" })}>
          Dashed
        </BarButton>
        <BarButton active={edge.style.marker === "arrow"} onClick={() => patch({ marker: edge.style.marker === "arrow" ? "none" : "arrow" })}>
          Arrow
        </BarButton>
        <input
          aria-label="Connector label"
          value={edge.label}
          placeholder="Label"
          className="h-7 w-28 rounded-md border border-line bg-transparent px-2 text-xs"
          onChange={(event) => dispatch({ type: "patchEdges", ids: [edge.id], label: event.target.value })}
        />
      </div>
    );
  }

  const first = nodes[0];
  const patch = (style: Partial<NodeStyle>) => dispatch({ type: "patchNodes", ids: nodes.map((node) => node.id), style });

  return (
    <div className="absolute top-3 left-1/2 z-20 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col gap-1 rounded-2xl border border-line bg-panel px-2 py-1.5 shadow-lg">
      <div className="flex flex-wrap items-center gap-1">
        {SHAPES.map((shape) => (
          <BarButton key={shape.id} active={first.style.shape === shape.id} onClick={() => patch({ shape: shape.id })}>
            {shape.label}
          </BarButton>
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        <BarButton active={first.style.fontWeight >= 600} label="Bold" onClick={() => patch({ fontWeight: first.style.fontWeight >= 600 ? 500 : 700 })}>
          <Bold size={14} />
        </BarButton>
        <BarButton active={first.style.fontStyle === "italic"} label="Italic" onClick={() => patch({ fontStyle: first.style.fontStyle === "italic" ? "normal" : "italic" })}>
          <Italic size={14} />
        </BarButton>
        <BarButton active={first.style.textDecoration === "underline"} label="Underline" onClick={() => patch({ textDecoration: first.style.textDecoration === "underline" ? "none" : "underline" })}>
          <Underline size={14} />
        </BarButton>
        <BarButton active={first.style.textAlign === "left"} label="Align left" onClick={() => patch({ textAlign: "left" })}>
          <AlignLeft size={14} />
        </BarButton>
        <BarButton active={first.style.textAlign === "center"} label="Align center" onClick={() => patch({ textAlign: "center" })}>
          <AlignCenter size={14} />
        </BarButton>
        <BarButton active={first.style.textAlign === "right"} label="Align right" onClick={() => patch({ textAlign: "right" })}>
          <AlignRight size={14} />
        </BarButton>
        <select
          aria-label="Font"
          value={first.style.fontFamily}
          className="h-7 rounded-md border border-line bg-transparent px-1 text-xs"
          onChange={(event) => patch({ fontFamily: event.target.value as NodeStyle["fontFamily"] })}
        >
          {FONT_OPTIONS.map((font) => (
            <option key={font.id} value={font.id}>{font.label}</option>
          ))}
        </select>
        <select
          aria-label="Font size"
          value={first.style.fontSize}
          className="h-7 rounded-md border border-line bg-transparent px-1 text-xs"
          onChange={(event) => patch({ fontSize: Number(event.target.value) })}
        >
          {[12, 13, 14, 16, 18, 20, 24].map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-muted">Fill</span>
        <Swatches value={first.style.background} onChange={(background) => patch({ background })} />
        <span className="text-[11px] text-muted">Text</span>
        <Swatches value={first.style.color} onChange={(color) => patch({ color })} />
        <span className="text-[11px] text-muted">Border</span>
        <Swatches value={first.style.borderColor} onChange={(borderColor) => patch({ borderColor })} />
        <BarButton onClick={() => dispatch({ type: "paintSubtree", nodeId: first.id, borderColor: first.style.borderColor })}>
          Apply to branch
        </BarButton>
        <BarButton active={details} onClick={() => setDetails((open) => !open)}>
          Details
        </BarButton>
      </div>
      {details ? (
        <div className="grid gap-2 border-t border-line pt-2 text-xs sm:grid-cols-2">
          <label className="flex items-center gap-2">
            Note
            <input
              value={first.note}
              aria-label="Note"
              className="h-7 min-w-0 flex-1 rounded-md border border-line bg-transparent px-2"
              onChange={(event) => dispatch({ type: "patchNodes", ids: [first.id], note: event.target.value })}
            />
          </label>
          <label className="flex items-center gap-2">
            Link
            <input
              value={first.href ?? ""}
              aria-label="Link"
              placeholder="https://"
              className="h-7 min-w-0 flex-1 rounded-md border border-line bg-transparent px-2"
              onChange={(event) => dispatch({ type: "patchNodes", ids: [first.id], href: event.target.value || null })}
            />
          </label>
          <label className="flex items-center gap-2">
            Tags
            <input
              value={first.tags.join(", ")}
              aria-label="Tags"
              className="h-7 min-w-0 flex-1 rounded-md border border-line bg-transparent px-2"
              onChange={(event) =>
                dispatch({
                  type: "patchNodes",
                  ids: [first.id],
                  tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean),
                })
              }
            />
          </label>
          <label className="flex items-center gap-2">
            Emoji
            <input
              value={first.emoji}
              aria-label="Emoji"
              className="h-7 w-16 rounded-md border border-line bg-transparent px-2"
              onChange={(event) => dispatch({ type: "patchNodes", ids: [first.id], emoji: event.target.value })}
            />
          </label>
          <label className="flex items-center gap-2">
            Opacity
            <input
              type="range"
              min={0.35}
              max={1}
              step={0.05}
              value={first.style.opacity}
              aria-label="Opacity"
              onChange={(event) => patch({ opacity: Number(event.target.value) })}
            />
          </label>
          <BarButton active={first.style.shadow === "soft"} onClick={() => patch({ shadow: first.style.shadow === "soft" ? "none" : "soft" })}>
            Shadow
          </BarButton>
        </div>
      ) : null}
    </div>
  );
}

function Swatches({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      {PALETTE.slice(0, 8).map((color) => (
        <button
          key={color.value}
          type="button"
          aria-label={color.name}
          className="h-4 w-4 rounded-full border border-black/10"
          style={{ background: color.value, outline: value.toLowerCase() === color.value ? "2px solid var(--arbour-accent)" : undefined, outlineOffset: 1 }}
          onClick={() => onChange(color.value)}
        />
      ))}
      <input
        type="color"
        aria-label="Custom color"
        value={toHex(value)}
        className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function BarButton({
  children,
  active,
  label,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  label?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={`rounded-md px-1.5 py-1 text-xs hover:bg-accent-soft ${active ? "bg-accent-soft text-accent" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function toHex(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#0f6e56";
}
