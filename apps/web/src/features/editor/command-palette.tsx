"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useReactFlow } from "@xyflow/react";

import { Modal } from "@/components/ui/dialog";
import { useActiveDocument, useDocumentAccess, useEditor } from "@/features/editor/store";

type CommandItem = { id: string; label: string; hint?: string; run: () => void };

export function CommandPalette() {
  const document = useActiveDocument();
  const access = useDocumentAccess();
  const open = useEditor((state) => state.commandPaletteOpen);
  const setOpen = useEditor((state) => state.setCommandPaletteOpen);
  const dispatch = useEditor((state) => state.dispatch);
  const selection = useEditor((state) => state.selection);
  const setSelection = useEditor((state) => state.setSelection);
  const setMoveNodeId = useEditor((state) => state.setMoveNodeId);
  const toggleOutline = useEditor((state) => state.toggleOutline);
  const { setCenter } = useReactFlow();
  const [query, setQuery] = useState("");

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const selectedId = selection[0] && document?.nodes[selection[0]] ? selection[0] : document?.rootId;
  const commands = useMemo<CommandItem[]>(() => {
    if (!document || !access.canEdit || !selectedId) return [{ id: "outline", label: "Toggle outline", run: toggleOutline }];
    return [
      { id: "child", label: "Add child topic", hint: "Tab", run: () => dispatch({ type: "addChild", parentId: selectedId }, { edit: true }) },
      { id: "sibling", label: "Add sibling topic", hint: "Enter", run: () => dispatch({ type: "addSibling", nodeId: selectedId }, { edit: true }) },
      { id: "rename", label: "Rename selected topic", hint: "F2", run: () => useEditor.getState().startEditing(selectedId, true) },
      ...(selectedId !== document.rootId ? [{ id: "move", label: "Move selected topic", hint: "⌘⇧M", run: () => setMoveNodeId(selectedId) }] : []),
      { id: "tidy", label: "Tidy map layout", run: () => dispatch({ type: "relayout" }) },
      { id: "outline", label: "Toggle outline", hint: "⌘\\", run: toggleOutline },
    ];
  }, [access.canEdit, dispatch, document, selectedId, setMoveNodeId, toggleOutline]);

  const normalized = query.trim().toLowerCase();
  const matchingCommands = commands.filter((item) => item.label.toLowerCase().includes(normalized));
  const matchingTopics = document
    ? Object.values(document.nodes).filter((node) => node.text.toLowerCase().includes(normalized)).slice(0, 8)
    : [];

  const reveal = (id: string) => {
    const node = document?.nodes[id];
    if (!node) return;
    setSelection([id]);
    void setCenter(node.position.x + node.width / 2, node.position.y + node.height / 2, { duration: 180 });
    close();
  };

  return (
    <Modal open={open} onOpenChange={(next) => next || close()} title="Command palette" description="Search actions or jump to a topic." className="p-3">
      <label className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-3">
        <Search size={16} className="text-muted" />
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actions or topics" aria-label="Search actions or topics" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" />
        <kbd className="rounded bg-panel px-1.5 py-0.5 text-[10px] text-muted">Esc</kbd>
      </label>
      <div className="mt-3 max-h-80 overflow-y-auto">
        {matchingCommands.length ? <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted uppercase">Actions</p> : null}
        {matchingCommands.map((item) => <PaletteButton key={item.id} label={item.label} hint={item.hint} onClick={() => { item.run(); close(); }} />)}
        {matchingTopics.length ? <p className="px-2 pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted uppercase">Topics</p> : null}
        {matchingTopics.map((node) => <PaletteButton key={node.id} label={node.text || "Untitled"} hint="Jump to topic" onClick={() => reveal(node.id)} />)}
        {!matchingCommands.length && !matchingTopics.length ? <p className="px-2 py-5 text-center text-sm text-muted">No matching action or topic.</p> : null}
      </div>
    </Modal>
  );
}

function PaletteButton({ label, hint, onClick }: { label: string; hint?: string; onClick: () => void }) {
  return <button type="button" className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm hover:bg-accent-soft" onClick={onClick}><span className="truncate">{label}</span>{hint ? <span className="ml-3 shrink-0 text-[11px] text-muted">{hint}</span> : null}</button>;
}
