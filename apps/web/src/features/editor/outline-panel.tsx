"use client";

import { childrenOf } from "@arbour/mindmap-core";

import { useActiveDocument, useEditor } from "@/features/editor/store";

export function OutlinePanel() {
  const open = useEditor((state) => state.showOutline);
  const document = useActiveDocument();
  const selection = useEditor((state) => state.selection);
  const setSelection = useEditor((state) => state.setSelection);
  if (!open || !document) return null;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-l border-line bg-panel" aria-label="Outline">
      <div className="border-b border-line px-3 py-2 text-xs font-medium tracking-wide text-muted uppercase">Outline</div>
      <div className="min-h-0 flex-1 overflow-auto py-2">
        <OutlineNodes parentId={null} rootId={document.rootId} depth={0} selection={selection} onSelect={(id) => setSelection([id])} />
      </div>
    </aside>
  );
}

function OutlineNodes({
  parentId,
  rootId,
  depth,
  selection,
  onSelect,
}: {
  parentId: string | null;
  rootId: string;
  depth: number;
  selection: string[];
  onSelect: (id: string) => void;
}) {
  const document = useActiveDocument();
  if (!document) return null;
  const nodes = parentId ? childrenOf(document, parentId) : [document.nodes[rootId]];
  return (
    <ul>
      {nodes.filter(Boolean).map((node) => (
        <li key={node.id}>
          <button
            type="button"
            className={`block w-full truncate py-1 pr-2 text-left text-sm hover:bg-accent-soft ${selection.includes(node.id) ? "bg-accent-soft" : ""}`}
            style={{ paddingLeft: 12 + depth * 14 }}
            aria-current={selection.includes(node.id) ? "true" : undefined}
            onClick={() => onSelect(node.id)}
          >
            {node.text || "Untitled"}
          </button>
          {node.collapsed ? null : (
            <OutlineNodes parentId={node.id} rootId={rootId} depth={depth + 1} selection={selection} onSelect={onSelect} />
          )}
        </li>
      ))}
    </ul>
  );
}
