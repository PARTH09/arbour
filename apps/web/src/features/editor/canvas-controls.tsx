"use client";

import { Hand, Image, MousePointer2, Spline, StickyNote, Type, ZoomIn, ZoomOut } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { useState, type ReactNode } from "react";

import { sanitizeHttpUrl } from "@arbour/mindmap-core";
import { IconButton } from "@/components/ui/icon-button";
import { Modal } from "@/components/ui/dialog";
import { fitActiveDocument } from "@/features/editor/fit-document";
import { useActiveDocument, useDocumentAccess, useEditor } from "@/features/editor/store";

export function CanvasControls() {
  const tool = useEditor((state) => state.tool);
  const setTool = useEditor((state) => state.setTool);
  const dispatch = useEditor((state) => state.dispatch);
  const selection = useEditor((state) => state.selection);
  const showMinimap = useEditor((state) => state.showMinimap);
  const toggleMinimap = useEditor((state) => state.toggleMinimap);
  const document = useActiveDocument();
  const access = useDocumentAccess();
  const { zoomIn, zoomOut, setViewport, getNodesBounds } = useReactFlow();
  const [imageOpen, setImageOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageError, setImageError] = useState("");

  const add = (nodeType: "topic" | "note" | "text") => {
    if (!document) return;
    const parentId = selection[0] && document.nodes[selection[0]] ? selection[0] : document.rootId;
    dispatch({ type: "addChild", parentId, nodeType }, { edit: true });
    setTool("select");
  };

  if (!document) return null;

  return (
    <>
      <div className="absolute top-1/2 left-3 z-20 flex -translate-y-1/2 flex-col gap-1 rounded-2xl border border-line bg-panel p-1 shadow-lg">
        <ToolButton label="Select" shortcut="V" active={tool === "select"} onClick={() => setTool("select")}>
          <MousePointer2 size={16} />
        </ToolButton>
        <ToolButton label="Pan" shortcut="Space" active={tool === "pan"} onClick={() => setTool("pan")}>
          <Hand size={16} />
        </ToolButton>
        {access.canEdit ? (
          <>
            <ToolButton label="Add topic" shortcut="Tab" onClick={() => add("topic")}>
              <span className="text-base leading-none">+</span>
            </ToolButton>
            <ToolButton label="Add cross-link" active={tool === "connect"} onClick={() => setTool("connect")}>
              <Spline size={16} />
            </ToolButton>
            <ToolButton label="Add note" onClick={() => add("note")}>
              <StickyNote size={16} />
            </ToolButton>
            <ToolButton label="Add text" onClick={() => add("text")}>
              <Type size={16} />
            </ToolButton>
            <ToolButton label="Add image" onClick={() => { setImageOpen(true); setImageError(""); }}>
              <Image size={16} />
            </ToolButton>
          </>
        ) : null}
      </div>
      <div className="absolute right-3 bottom-3 z-20 flex items-center gap-1 rounded-2xl border border-line bg-panel p-1 shadow-lg">
        <IconButton label="Zoom out" onClick={() => zoomOut({ duration: 160 })}>
          <ZoomOut size={16} />
        </IconButton>
        <IconButton label="Zoom in" onClick={() => zoomIn({ duration: 160 })}>
          <ZoomIn size={16} />
        </IconButton>
        <button type="button" className="h-8 rounded-lg px-2 text-xs hover:bg-accent-soft" onClick={() => void fitActiveDocument({ setViewport, getNodesBounds }, { duration: 180 })}>
          Fit
        </button>
        <button
          type="button"
          className={`h-8 rounded-lg px-2 text-xs hover:bg-accent-soft ${showMinimap ? "bg-accent-soft" : ""}`}
          onClick={toggleMinimap}
        >
          Map
        </button>
      </div>
      {tool === "connect" ? (
        <p className="pointer-events-none absolute bottom-16 left-1/2 z-20 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-xs text-panel">
          Drag from one topic to another
        </p>
      ) : null}
      <Modal open={imageOpen} onOpenChange={setImageOpen} title="Add an image" description="Paste an image link. Files stay out of the map until uploads arrive.">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!document) return;
            const url = sanitizeHttpUrl(imageUrl);
            if (!url) {
              setImageError("Use an http or https link.");
              return;
            }
            const parentId = selection[0] && document.nodes[selection[0]] ? selection[0] : null;
            if (parentId) {
              dispatch({ type: "addChild", parentId, nodeType: "image", imageUrl: url, text: "Image" });
            } else {
              const root = document.nodes[document.rootId];
              dispatch({
                type: "addFloating",
                nodeType: "image",
                imageUrl: url,
                text: "Image",
                position: { x: root.position.x + 160, y: root.position.y + 160 },
              });
            }
            setImageUrl("");
            setImageOpen(false);
          }}
        >
          <input
            autoFocus
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="https://"
            aria-label="Image link"
            className="h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none"
          />
          {imageError ? <p className="text-xs text-danger">{imageError}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="h-8 rounded-lg px-3 text-sm" onClick={() => setImageOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="h-8 rounded-lg bg-accent px-3 text-sm text-white">
              Add image
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function ToolButton({
  label,
  shortcut,
  active,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <IconButton label={label} shortcut={shortcut} active={active} onClick={onClick}>
      {children}
    </IconButton>
  );
}
