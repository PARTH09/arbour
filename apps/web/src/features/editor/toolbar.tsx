"use client";

import { DENSITY_PRESETS, documentFromOutline, documentRoleLabel, parseDocument, THEMES, type LayoutOrientation } from "@arbour/mindmap-core";
import {
  Download,
  Grid3x3,
  ListTree,
  Map,
  Moon,
  PanelLeft,
  Redo2,
  Share2,
  Sun,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useReactFlow } from "@xyflow/react";

import { IconButton } from "@/components/ui/icon-button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from "@/components/ui/menu";
import { exportActiveDocument } from "@/features/editor/export-document";
import { fitActiveDocument } from "@/features/editor/fit-document";
import { useActiveDocument, useDocumentAccess, useEditor, type SaveStatus } from "@/features/editor/store";

const ORIENTATIONS: { id: LayoutOrientation; label: string }[] = [
  { id: "balanced", label: "Balanced" },
  { id: "right", label: "Left to right" },
  { id: "left", label: "Right to left" },
  { id: "down", label: "Top to bottom" },
  { id: "up", label: "Bottom to top" },
  { id: "radial", label: "Radial" },
];

export function Toolbar() {
  const document = useActiveDocument();
  const dispatch = useEditor((state) => state.dispatch);
  const undo = useEditor((state) => state.undo);
  const redo = useEditor((state) => state.redo);
  const past = useEditor((state) => state.past.length);
  const future = useEditor((state) => state.future.length);
  const saveStatus = useEditor((state) => state.saveStatus);
  const zoom = useEditor((state) => state.zoom);
  const theme = useEditor((state) => state.theme);
  const showGrid = useEditor((state) => state.showGrid);
  const showMinimap = useEditor((state) => state.showMinimap);
  const showOutline = useEditor((state) => state.showOutline);
  const toggleOutline = useEditor((state) => state.toggleOutline);
  const displayName = useEditor((state) => state.displayName);
  const toggleSidebar = useEditor((state) => state.toggleSidebar);
  const toggleGrid = useEditor((state) => state.toggleGrid);
  const toggleMinimap = useEditor((state) => state.toggleMinimap);
  const setTheme = useEditor((state) => state.setTheme);
  const setShareOpen = useEditor((state) => state.setShareOpen);
  const setShortcutsOpen = useEditor((state) => state.setShortcutsOpen);
  const showBanner = useEditor((state) => state.showBanner);
  const importDocument = useEditor((state) => state.importDocument);
  const trashDocument = useEditor((state) => state.trashDocument);
  const duplicateDocument = useEditor((state) => state.duplicateDocument);
  const access = useDocumentAccess();
  const { zoomIn, zoomOut, setViewport, getNodesBounds, zoomTo } = useReactFlow();

  if (!document) {
    return (
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-panel/90 px-2">
        <IconButton label="Hide or show library" onClick={toggleSidebar}>
          <PanelLeft size={16} />
        </IconButton>
        <span className="text-sm text-muted">No map open</span>
      </header>
    );
  }
  const motion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180;

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-line bg-panel/90 px-2">
      <IconButton label="Hide or show library" onClick={toggleSidebar}>
        <PanelLeft size={16} />
      </IconButton>
      <input
        aria-label="Document title"
        readOnly={!access.canEdit}
        value={document.title}
        className="h-8 w-40 min-w-0 rounded-md bg-transparent px-2 text-sm font-medium outline-none hover:bg-accent-soft focus:bg-accent-soft sm:w-56 read-only:hover:bg-transparent"
        onChange={(event) => dispatch({ type: "setTitle", title: event.target.value }, { coalesceKey: "title" })}
      />
      {access.role ? (
        <button
          type="button"
          className="hidden h-7 rounded-full bg-accent-soft px-2 text-[11px] text-muted sm:inline"
          aria-label={`Your role is ${documentRoleLabel(access.role)}`}
          onClick={() => setShareOpen(true)}
        >
          {documentRoleLabel(access.role)}
        </button>
      ) : null}
      <Status status={saveStatus} />
      <div className="mx-1 hidden h-5 w-px bg-line sm:block" />
      <IconButton label="Undo" shortcut="⌘Z" disabled={!past || !access.canEdit} onClick={undo}>
        <Undo2 size={16} />
      </IconButton>
      <IconButton label="Redo" shortcut="⇧⌘Z" disabled={!future || !access.canEdit} onClick={redo}>
        <Redo2 size={16} />
      </IconButton>
      {access.canEdit ? <Menu>
        <MenuTrigger asChild>
          <button type="button" className="hidden h-8 rounded-lg px-2 text-xs hover:bg-accent-soft sm:inline-flex">
            Layout
          </button>
        </MenuTrigger>
        <MenuContent align="start">
          <MenuLabel>Direction</MenuLabel>
          {ORIENTATIONS.map((item) => (
            <MenuItem key={item.id} onSelect={() => dispatch({ type: "setLayout", layout: { orientation: item.id } })}>
              {item.label}
              {document.layout.orientation === item.id ? <span className="text-accent">Current</span> : null}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuLabel>Spacing</MenuLabel>
          {(Object.keys(DENSITY_PRESETS) as (keyof typeof DENSITY_PRESETS)[]).map((density) => (
            <MenuItem
              key={density}
              onSelect={() => dispatch({ type: "setLayout", layout: { density, ...DENSITY_PRESETS[density] } })}
            >
              {density[0].toUpperCase() + density.slice(1)}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem onSelect={() => dispatch({ type: "setLayout", layout: { levelGap: 0 } })}>Even levels</MenuItem>
          <MenuItem onSelect={() => dispatch({ type: "setLayout", layout: { levelGap: 12 } })}>Stepped levels</MenuItem>
          <MenuItem onSelect={() => dispatch({ type: "relayout" })}>Tidy layout</MenuItem>
        </MenuContent>
      </Menu> : null}
      <div className="ml-auto flex items-center gap-1">
        <IconButton label="Zoom out" shortcut="−" onClick={() => zoomOut({ duration: motion })}>
          <ZoomOut size={16} />
        </IconButton>
        <button
          type="button"
          className="h-8 min-w-12 rounded-lg px-1 text-xs tabular-nums hover:bg-accent-soft"
          onClick={() => zoomTo(1, { duration: motion })}
          aria-label="Reset zoom to 100 percent"
        >
          {Math.round(zoom * 100)}%
        </button>
        <IconButton label="Zoom in" shortcut="+" onClick={() => zoomIn({ duration: motion })}>
          <ZoomIn size={16} />
        </IconButton>
        <button
          type="button"
          className="hidden h-8 rounded-lg px-2 text-xs hover:bg-accent-soft md:inline-flex"
          onClick={() => void fitActiveDocument({ setViewport, getNodesBounds }, { duration: motion })}
        >
          Fit
        </button>
        <IconButton label="Toggle minimap" active={showMinimap} onClick={toggleMinimap}>
          <Map size={16} />
        </IconButton>
        <IconButton label="Toggle outline" shortcut="⌘\\" active={showOutline} onClick={toggleOutline}>
          <ListTree size={16} />
        </IconButton>
        <IconButton label="Toggle grid" active={showGrid} onClick={toggleGrid}>
          <Grid3x3 size={16} />
        </IconButton>
        <IconButton label={theme === "dark" ? "Use light theme" : "Use dark theme"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </IconButton>
        <span className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white" title={displayName}>
          {initials(displayName)}
        </span>
        <Menu>
          <MenuTrigger asChild>
            <button type="button" aria-label="Export" className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent-soft">
              <Download size={16} />
            </button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => void exportActiveDocument("json")}>Export as JSON</MenuItem>
            <MenuItem onSelect={() => void exportActiveDocument("outline")}>Outline</MenuItem>
            <MenuItem onSelect={() => void exportActiveDocument("svg")}>SVG</MenuItem>
            <MenuItem onSelect={() => void exportActiveDocument("png")}>PNG</MenuItem>
          </MenuContent>
        </Menu>
        <IconButton label="Share" onClick={() => setShareOpen(true)}>
          <Share2 size={16} />
        </IconButton>
        <Menu>
          <MenuTrigger asChild>
            <button type="button" aria-label="Document options" className="h-8 rounded-lg px-2 text-xs hover:bg-accent-soft">
              Options
            </button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => duplicateDocument(document.id)}>Duplicate</MenuItem>
            {access.canEdit ? (
              <MenuSub>
                <MenuSubTrigger>Theme</MenuSubTrigger>
                <MenuSubContent>
                  {THEMES.map((item) => (
                    <MenuItem key={item.id} onSelect={() => dispatch({ type: "applyTheme", themeId: item.id })}>
                      {item.name}
                    </MenuItem>
                  ))}
                </MenuSubContent>
              </MenuSub>
            ) : null}
            {access.canEdit ? <MenuItem onSelect={() => dispatch({ type: "relayout" })}>Tidy layout</MenuItem> : null}
            <MenuItem onSelect={() => setShortcutsOpen(true)}>Keyboard shortcuts</MenuItem>
            <MenuItem onSelect={() => void exportActiveDocument("json")}>Export as JSON</MenuItem>
            {access.canEdit ? <MenuItem
              onSelect={() => {
                const input = window.document.createElement("input");
                input.type = "file";
                input.accept = "application/json,.json,.txt,.md,text/plain";
                input.onchange = async () => {
                  const file = input.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  if (file.size > 2_000_000) {
                    showBanner("That file is too large to import.");
                    return;
                  }
                  try {
                    const parsed = JSON.parse(text) as unknown;
                    const result = parseDocument(parsed);
                    if (!result.ok) {
                      showBanner(result.error);
                      return;
                    }
                    importDocument(result.document);
                  } catch {
                    const imported = documentFromOutline(text, file.name.replace(/\.[^.]+$/, ""));
                    if (!imported) {
                      showBanner("That file isn't a valid outline.");
                      return;
                    }
                    importDocument(imported);
                  }
                };
                input.click();
              }}
            >
              Import
            </MenuItem> : null}
            {access.canManage ? <MenuSeparator /> : null}
            {access.canManage ? <MenuItem onSelect={() => trashDocument(document.id)}>Move to trash</MenuItem> : null}
          </MenuContent>
        </Menu>
      </div>
    </header>
  );
}

function Status({ status }: { status: SaveStatus }) {
  const label = {
    saving: "Saving…",
    saved: "Saved locally",
    offline: "Saved on this device · Offline",
    error: "Not saved",
  }[status];
  const color = status === "error" ? "bg-danger" : status === "saving" ? "bg-amber-500" : "bg-accent";
  return (
    <span className="hidden items-center gap-1.5 text-xs text-muted sm:inline-flex" aria-live="polite">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
