"use client";

import {
  childrenOf,
  documentFromDocumentText,
  documentFromOutline,
  parseDocument,
  sanitizeHttpUrl,
  sanitizeImageUrl,
} from "@arbour/mindmap-core";
import {
  CircleHelp,
  FileUp,
  FoldVertical,
  Hand,
  Image,
  Languages,
  MousePointer2,
  Plus,
  Sparkles,
  Spline,
  StickyNote,
  Type,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { useRef, useState, type ReactNode } from "react";

import { IconButton } from "@/components/ui/icon-button";
import { Modal } from "@/components/ui/dialog";
import { extractTextFromPdf } from "@/features/editor/pdf-import";
import { fitActiveDocument } from "@/features/editor/fit-document";
import { useActiveDocument, useDocumentAccess, useEditor } from "@/features/editor/store";

const MAX_UPLOAD_BYTES = 750_000;

export function CanvasControls() {
  const tool = useEditor((state) => state.tool);
  const setTool = useEditor((state) => state.setTool);
  const dispatch = useEditor((state) => state.dispatch);
  const selection = useEditor((state) => state.selection);
  const showMinimap = useEditor((state) => state.showMinimap);
  const toggleMinimap = useEditor((state) => state.toggleMinimap);
  const setTranslateOpen = useEditor((state) => state.setTranslateOpen);
  const setHelpOpen = useEditor((state) => state.setHelpOpen);
  const showBanner = useEditor((state) => state.showBanner);
  const importDocument = useEditor((state) => state.importDocument);
  const document = useActiveDocument();
  const access = useDocumentAccess();
  const { zoomIn, zoomOut, setViewport, getNodesBounds } = useReactFlow();
  const [imageOpen, setImageOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const add = (nodeType: "topic" | "note" | "text") => {
    if (!document) return;
    const parentId = selection[0] && document.nodes[selection[0]] ? selection[0] : document.rootId;
    dispatch({ type: "addChild", parentId, nodeType }, { edit: true });
    setTool("select");
  };

  const addImageNode = (url: string, text = "Image") => {
    if (!document) return;
    const parentId = selection[0] && document.nodes[selection[0]] ? selection[0] : null;
    if (parentId) {
      dispatch({ type: "addChild", parentId, nodeType: "image", imageUrl: url, text });
    } else {
      const root = document.nodes[document.rootId];
      dispatch({
        type: "addFloating",
        nodeType: "image",
        imageUrl: url,
        text,
        position: { x: root.position.x + 160, y: root.position.y + 160 },
      });
    }
    setTool("select");
  };

  const toggleCollapseAll = () => {
    if (!document) return;
    const ids = Object.values(document.nodes)
      .filter((node) => childrenOf(document, node.id).length > 0)
      .map((node) => node.id);
    if (!ids.length) {
      showBanner("Nothing to collapse on this map.");
      return;
    }
    const anyExpanded = ids.some((id) => !document.nodes[id]?.collapsed);
    dispatch({ type: "setCollapsed", ids, collapsed: anyExpanded });
    showBanner(anyExpanded ? "Collapsed all branches." : "Expanded all branches.");
  };

  const importFile = async (file: File) => {
    if (file.size > 8_000_000) {
      showBanner("That file is too large to import.");
      return;
    }
    const name = file.name.replace(/\.[^.]+$/, "");
    const lower = file.name.toLowerCase();
    try {
      if (lower.endsWith(".pdf")) {
        showBanner("Reading PDF…");
        const text = await extractTextFromPdf(file);
        if (!text.trim()) {
          showBanner("No text found in that PDF. Scanned pages need OCR first.");
          return;
        }
        const imported = documentFromDocumentText(text, name);
        if (!imported) {
          showBanner("Could not build a mind map from that PDF.");
          return;
        }
        importDocument(imported);
        showBanner("Mind map built from the PDF.");
        return;
      }
      const text = await file.text();
      const looksJson = lower.endsWith(".json") || /^\s*[{\[]/.test(text);
      if (looksJson) {
        try {
          const parsed = JSON.parse(text) as unknown;
          const result = parseDocument(parsed);
          if (!result.ok) {
            showBanner(result.error);
            return;
          }
          importDocument(result.document);
          return;
        } catch {
          showBanner("That JSON file isn't a valid Arbour map.");
          return;
        }
      }
      const imported = documentFromOutline(text, name) ?? documentFromDocumentText(text, name);
      if (!imported) {
        showBanner("That file isn't a valid outline, Markdown, or document.");
        return;
      }
      importDocument(imported);
    } catch {
      showBanner("Import failed. Try a smaller file or a text-based PDF.");
    }
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
            <ToolDivider />
            <ToolButton label="Add topic" shortcut="Tab" onClick={() => add("topic")}>
              <Plus size={16} />
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
            <ToolButton
              label="Add image"
              onClick={() => {
                setImageOpen(true);
                setImageError("");
              }}
            >
              <Image size={16} />
            </ToolButton>

            <ToolDivider />
            <ToolButton label="Translate map" onClick={() => setTranslateOpen(true)}>
              <Languages size={16} />
            </ToolButton>
            <ToolButton label="Collapse or expand all" shortcut="⇧⌘/" onClick={toggleCollapseAll}>
              <FoldVertical size={16} />
            </ToolButton>
            <ToolButton
              label="Tidy layout"
              onClick={() => {
                dispatch({ type: "relayout" });
                showBanner("Layout tidied.");
              }}
            >
              <Sparkles size={16} />
            </ToolButton>
            <ToolButton label="Import PDF or outline" onClick={() => importInput.current?.click()}>
              <FileUp size={16} />
            </ToolButton>
          </>
        ) : null}

        <ToolDivider />
        <ToolButton label="Help & learning" shortcut="?" onClick={() => setHelpOpen(true, null)}>
          <CircleHelp size={16} />
        </ToolButton>
      </div>

      <input
        ref={importInput}
        type="file"
        accept="application/json,.json,.txt,.md,.markdown,text/plain,text/markdown,application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void importFile(file);
        }}
      />

      <div className="absolute right-3 bottom-3 z-20 flex items-center gap-1 rounded-2xl border border-line bg-panel p-1 shadow-lg">
        <IconButton label="Zoom out" onClick={() => zoomOut({ duration: 160 })}>
          <ZoomOut size={16} />
        </IconButton>
        <IconButton label="Zoom in" onClick={() => zoomIn({ duration: 160 })}>
          <ZoomIn size={16} />
        </IconButton>
        <button
          type="button"
          className="h-8 rounded-lg px-2 text-xs hover:bg-accent-soft"
          onClick={() => void fitActiveDocument({ setViewport, getNodesBounds }, { duration: 180 })}
        >
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
      <Modal
        open={imageOpen}
        onOpenChange={setImageOpen}
        title="Add an image"
        description="Upload a small image from this device, or paste an http(s) link."
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const url = sanitizeHttpUrl(imageUrl);
            if (!url) {
              setImageError("Use an http or https link, or upload a file.");
              return;
            }
            addImageNode(url);
            setImageUrl("");
            setImageOpen(false);
          }}
        >
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (file.size > MAX_UPLOAD_BYTES) {
                setImageError("Keep uploads under 750 KB so maps stay light in this browser.");
                return;
              }
              try {
                const dataUrl = await readFileAsDataUrl(file);
                const safe = sanitizeImageUrl(dataUrl);
                if (!safe) {
                  setImageError("That image type isn't supported.");
                  return;
                }
                addImageNode(safe, file.name.replace(/\.[^.]+$/, "") || "Image");
                setImageUrl("");
                setImageOpen(false);
              } catch {
                setImageError("This browser could not read that file.");
              }
            }}
          />
          <button
            type="button"
            className="flex h-9 w-full items-center justify-center rounded-lg border border-dashed border-line text-sm hover:bg-accent-soft"
            onClick={() => fileInput.current?.click()}
          >
            Upload from this device
          </button>
          <input
            autoFocus
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="https://… or leave blank and upload"
            aria-label="Image link"
            className="h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none"
          />
          {imageError ? <p className="text-xs text-danger">{imageError}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="h-8 rounded-lg px-3 text-sm" onClick={() => setImageOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="h-8 rounded-lg bg-accent px-3 text-sm text-white">
              Add link
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function ToolDivider() {
  return <div className="mx-1 my-0.5 h-px bg-line" role="separator" />;
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
