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
  if (document) return null;
  return (
    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted">
      No maps are shared with you. Create one from the library, or switch person in settings.
    </div>
  );
}
