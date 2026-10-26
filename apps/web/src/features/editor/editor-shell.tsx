"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { useEffect } from "react";

import { TooltipProvider } from "@/components/ui/icon-button";
import { Canvas } from "@/features/editor/canvas";
import { CanvasControls } from "@/features/editor/canvas-controls";
import { Banner, Dialogs } from "@/features/editor/dialogs";
import { FormatBar } from "@/features/editor/format-bar";
import { Hotkeys } from "@/features/editor/hotkeys";
import { OutlinePanel } from "@/features/editor/outline-panel";
import { Sidebar } from "@/features/editor/sidebar";
import { useActiveDocument, useEditor } from "@/features/editor/store";
import { Toolbar } from "@/features/editor/toolbar";

export function EditorShell() {
  const ready = useEditor((state) => state.ready);
  const hydrate = useEditor((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!ready) {
    return <div className="h-dvh bg-canvas" />;
  }

  return (
    <TooltipProvider>
      <ReactFlowProvider>
        <div className="flex h-dvh overflow-hidden bg-app text-ink">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Toolbar />
            <div className="flex min-h-0 flex-1">
              <div className="relative min-w-0 flex-1">
                <Canvas />
                <FormatBar />
                <CanvasControls />
                <EmptyMap />
              </div>
              <OutlinePanel />
            </div>
          </div>
        </div>
        <Hotkeys />
        <Dialogs />
        <Banner />
      </ReactFlowProvider>
    </TooltipProvider>
  );
}

function EmptyMap() {
  const document = useActiveDocument();
  const createMap = useEditor((state) => state.createMap);
  const setHelpOpen = useEditor((state) => state.setHelpOpen);
  const setSettingsOpen = useEditor((state) => state.setSettingsOpen);
  if (document) return null;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div>
        <p className="font-display text-xl font-medium tracking-tight">No map open</p>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Create a map from the library, open a template, or check that your account can view maps on this device.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          className="h-9 rounded-xl bg-accent px-4 text-sm font-medium text-white hover:opacity-90"
          onClick={() => createMap()}
        >
          New map
        </button>
        <button
          type="button"
          className="h-9 rounded-xl border border-line px-4 text-sm hover:bg-accent-soft"
          onClick={() => setHelpOpen(true, null)}
        >
          Learn Arbour
        </button>
        <button
          type="button"
          className="h-9 rounded-xl border border-line px-4 text-sm hover:bg-accent-soft"
          onClick={() => setSettingsOpen(true)}
        >
          Settings
        </button>
      </div>
    </div>
  );
}
