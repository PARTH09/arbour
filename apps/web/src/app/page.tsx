"use client";

import dynamic from "next/dynamic";

const EditorShell = dynamic(
  () => import("@/features/editor/editor-shell").then((module) => module.EditorShell),
  {
    ssr: false,
    loading: () => <div className="h-dvh bg-canvas" />,
  },
);

export default function HomePage() {
  return <EditorShell />;
}
