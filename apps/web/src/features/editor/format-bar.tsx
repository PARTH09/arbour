"use client";

import {
  FONT_OPTIONS,
  mapHref,
  PALETTE,
  parseMapHref,
  TOPIC_ICONS,
  type EdgeStyle,
  type NodeShape,
  type NodeStyle,
} from "@arbour/mindmap-core";
import { useReactFlow } from "@xyflow/react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Underline } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useActiveDocument, useDocumentAccess, useEditor } from "@/features/editor/store";

const SHAPES: { id: NodeShape; label: string }[] = [
  { id: "rounded", label: "Rounded" },
  { id: "rectangle", label: "Rectangle" },
  { id: "pill", label: "Pill" },
  { id: "ellipse", label: "Ellipse" },
  { id: "underline", label: "Underline" },
  { id: "borderless", label: "Borderless" },
];

export type StyleClipboard = {
  style: Partial<NodeStyle>;
  emoji?: string;
};

/** Shared with hotkeys so Mod+Alt+C / V match the format-bar buttons. */
export let styleClipboard: StyleClipboard | null = null;

export function setStyleClipboard(next: StyleClipboard | null) {
  styleClipboard = next;
}

export function FormatBar() {
  const document = useActiveDocument();
  const documents = useEditor((state) => state.documents);
  const selection = useEditor((state) => state.selection);
  const selectedEdgeId = useEditor((state) => state.selectedEdgeId);
  const dispatch = useEditor((state) => state.dispatch);
  const setMoveNodeId = useEditor((state) => state.setMoveNodeId);
  const access = useDocumentAccess();
  const [details, setDetails] = useState(false);
  const [iconsOpen, setIconsOpen] = useState(false);
  const [styleCopied, setStyleCopied] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  const { flowToScreenPosition } = useReactFlow();

  const edge = selectedEdgeId && document ? document.edges[selectedEdgeId] : undefined;
  const nodes = document ? selection.map((id) => document.nodes[id]).filter(Boolean) : [];

  const firstSelected = nodes[0];
  const anchorKey = firstSelected
    ? `${firstSelected.id}:${firstSelected.position.x}:${firstSelected.position.y}:${firstSelected.width}`
    : "";

  useEffect(() => {
    if (!document || !firstSelected || edge) {
      // The floating bar must disappear as soon as selection changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnchor(null);
      return;
    }
    const parent = hostRef.current?.parentElement;
    if (!parent) return;
    const update = () => {
      const screen = flowToScreenPosition({
        x: firstSelected.position.x + firstSelected.width / 2,
        y: firstSelected.position.y,
      });
      const bounds = parent.getBoundingClientRect();
      setAnchor({
        left: screen.x - bounds.left,
        top: Math.max(8, screen.y - bounds.top - 12),
      });
    };
    update();
    const frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [anchorKey, document, edge, firstSelected, flowToScreenPosition]);

  if (!document || !access.canEdit) return null;
  if (!nodes.length && !edge) return null;

  if (edge && !nodes.length) {
    const patch = (style: Partial<EdgeStyle>) => dispatch({ type: "patchEdges", ids: [edge.id], style });
    return (
      <div
        ref={hostRef}
        className="absolute top-3 left-1/2 z-20 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center gap-1 rounded-2xl border border-line bg-panel px-2 py-1.5 shadow-lg"
      >
        {(["bezier", "straight", "orthogonal"] as const).map((path) => (
          <BarButton key={path} active={edge.style.path === path} onClick={() => patch({ path })}>
            {path === "bezier" ? "Curve" : path === "straight" ? "Line" : "Elbow"}
          </BarButton>
        ))}
        <Swatches value={edge.style.stroke} onChange={(stroke) => patch({ stroke })} />
        <label className="flex items-center gap-1 text-[11px] text-muted">
          Width
          <select
            aria-label="Stroke width"
            className="h-7 rounded-md border border-line bg-transparent px-1 text-xs text-ink"
            value={edge.style.strokeWidth}
            onChange={(event) => patch({ strokeWidth: Number(event.target.value) })}
          >
            {[1, 1.5, 2, 3, 4].map((width) => (
              <option key={width} value={width}>{width}</option>
            ))}
          </select>
        </label>
        {(["solid", "dashed", "dotted"] as const).map((lineStyle) => (
          <BarButton key={lineStyle} active={edge.style.lineStyle === lineStyle} onClick={() => patch({ lineStyle })}>
            {lineStyle === "solid" ? "Solid" : lineStyle === "dashed" ? "Dashed" : "Dotted"}
          </BarButton>
        ))}
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
  const copyStyle = () => {
    setStyleClipboard({
      style: { ...first.style, themeLock: true },
      emoji: first.emoji || undefined,
    });
    setStyleCopied(true);
    window.setTimeout(() => setStyleCopied(false), 1200);
  };
  const pasteStyle = () => {
    if (!styleClipboard) return;
    dispatch({
      type: "patchNodes",
      ids: nodes.map((node) => node.id),
      style: styleClipboard.style,
      emoji: styleClipboard.emoji,
    });
  };

  return (
    <div
      ref={hostRef}
      className="absolute z-20 flex max-w-[min(36rem,calc(100%-2rem))] flex-col gap-1 rounded-2xl border border-line bg-panel px-2 py-1.5 shadow-lg"
      style={
        anchor
          ? { left: anchor.left, top: anchor.top, transform: "translate(-50%, -100%)" }
          : { left: "50%", top: 12, transform: "translateX(-50%)" }
      }
    >
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
        {nodes.length === 1 && first.id !== document.rootId ? (
          <BarButton label="Move under another topic" onClick={() => setMoveNodeId(first.id)}>
            Move
          </BarButton>
        ) : null}
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
        <BarButton label="Copy style" onClick={copyStyle}>
          {styleCopied ? "Copied" : "Copy style"}
        </BarButton>
        <BarButton label="Paste style" onClick={pasteStyle}>
          Paste style
        </BarButton>
        <BarButton active={iconsOpen} onClick={() => setIconsOpen((open) => !open)}>
          Icon
        </BarButton>
        <BarButton active={details} onClick={() => setDetails((open) => !open)}>
          Details
        </BarButton>
      </div>
      {iconsOpen ? (
        <div className="flex flex-wrap gap-1 border-t border-line pt-2" role="listbox" aria-label="Topic icons">
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-muted hover:bg-accent-soft"
            onClick={() => {
              dispatch({ type: "patchNodes", ids: nodes.map((node) => node.id), emoji: "" });
              setIconsOpen(false);
            }}
          >
            None
          </button>
          {TOPIC_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              role="option"
              aria-selected={first.emoji === icon}
              className={`rounded-md px-1.5 py-1 text-base hover:bg-accent-soft ${first.emoji === icon ? "bg-accent-soft ring-1 ring-accent" : ""}`}
              onClick={() => {
                dispatch({ type: "patchNodes", ids: nodes.map((node) => node.id), emoji: icon });
                setIconsOpen(false);
              }}
            >
              {icon}
            </button>
          ))}
        </div>
      ) : null}
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
          <label className="flex items-center gap-2 sm:col-span-2">
            Link
            <input
              value={parseMapHref(first.href) ? "" : first.href ?? ""}
              aria-label="Website link"
              placeholder="https://website"
              className="h-7 min-w-0 flex-1 rounded-md border border-line bg-transparent px-2"
              onChange={(event) => dispatch({ type: "patchNodes", ids: [first.id], href: event.target.value || null })}
            />
            <select
              aria-label="Link to another map"
              className="h-7 max-w-40 rounded-md border border-line bg-transparent px-1"
              value={parseMapHref(first.href) ?? ""}
              onChange={(event) =>
                dispatch({
                  type: "patchNodes",
                  ids: [first.id],
                  href: event.target.value ? mapHref(event.target.value) : null,
                })
              }
            >
              <option value="">Map on this device</option>
              {documents
                .filter((item) => item.id !== document.id)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
            </select>
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
            Custom icon
            <input
              value={first.emoji}
              aria-label="Custom icon"
              className="h-7 w-16 rounded-md border border-line bg-transparent px-2"
              onChange={(event) => dispatch({ type: "patchNodes", ids: [first.id], emoji: event.target.value })}
            />
          </label>
          <label className="flex items-center gap-2">
            Border width
            <select
              aria-label="Border width"
              className="h-7 rounded-md border border-line bg-transparent px-1"
              value={first.style.borderWidth}
              onChange={(event) => patch({ borderWidth: Number(event.target.value) })}
            >
              {[0, 1, 1.5, 2, 3].map((width) => (
                <option key={width} value={width}>{width}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            Border style
            <select
              aria-label="Border style"
              className="h-7 rounded-md border border-line bg-transparent px-1"
              value={first.style.borderStyle}
              onChange={(event) => patch({ borderStyle: event.target.value as NodeStyle["borderStyle"] })}
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
              <option value="none">None</option>
            </select>
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
