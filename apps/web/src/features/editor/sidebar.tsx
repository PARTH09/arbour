"use client";

import { documentRoleLabel, listTemplates, workspaceRoleLabel } from "@arbour/mindmap-core";
import { ChevronDown, ChevronRight, Clock3, FilePlus2, Folder, FolderPlus, Search, Share2, Star, Trash2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { folderAccess, memberAccess, useEditor, type LibraryView } from "@/features/editor/store";

const VIEWS: { id: LibraryView; label: string; icon: typeof Folder }[] = [
  { id: "home", label: "My maps", icon: Folder },
  { id: "recent", label: "Recent", icon: Clock3 },
  { id: "favorites", label: "Favorites", icon: Star },
  { id: "trash", label: "Trash", icon: Trash2 },
  { id: "templates", label: "Templates", icon: FilePlus2 },
];

export function Sidebar() {
  const collapsed = useEditor((state) => state.sidebarCollapsed);
  const view = useEditor((state) => state.libraryView);
  const setView = useEditor((state) => state.setLibraryView);
  const query = useEditor((state) => state.query);
  const setQuery = useEditor((state) => state.setQuery);
  const documents = useEditor((state) => state.documents);
  const trash = useEditor((state) => state.trash);
  const favorites = useEditor((state) => state.favorites);
  const recents = useEditor((state) => state.recents);
  const folders = useEditor((state) => state.folders);
  const documentFolders = useEditor((state) => state.documentFolders);
  const activeId = useEditor((state) => state.activeId);
  const workspaceName = useEditor((state) => state.workspaceName);
  const displayName = useEditor((state) => state.displayName);
  const members = useEditor((state) => state.members);
  const grants = useEditor((state) => state.grants);
  const folderGrants = useEditor((state) => state.folderGrants);
  const activeMemberId = useEditor((state) => state.activeMemberId);
  const openDocument = useEditor((state) => state.openDocument);
  const createMap = useEditor((state) => state.createMap);
  const createFolder = useEditor((state) => state.createFolder);
  const renameFolder = useEditor((state) => state.renameFolder);
  const deleteFolder = useEditor((state) => state.deleteFolder);
  const moveDocumentToFolder = useEditor((state) => state.moveDocumentToFolder);
  const setShareFolderId = useEditor((state) => state.setShareFolderId);
  const createFromTemplate = useEditor((state) => state.createFromTemplate);
  const toggleFavorite = useEditor((state) => state.toggleFavorite);
  const duplicateDocument = useEditor((state) => state.duplicateDocument);
  const trashDocument = useEditor((state) => state.trashDocument);
  const restoreDocument = useEditor((state) => state.restoreDocument);
  const deleteForever = useEditor((state) => state.deleteForever);
  const setSettingsOpen = useEditor((state) => state.setSettingsOpen);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  const needle = query.trim().toLowerCase();
  const accessState = { members, grants, folderGrants, documentFolders, activeMemberId };
  const actor = members.find((member) => member.id === activeMemberId);
  const workspaceOwner = actor?.workspaceRole === "owner";
  const allowedDocs = documents.filter((document) => memberAccess(accessState, document.id).canView);
  const visibleDocs =
    view === "favorites"
      ? allowedDocs.filter((document) => favorites.includes(document.id))
      : view === "recent"
        ? recents.map((id) => allowedDocs.find((document) => document.id === id)).filter((document) => document != null)
        : allowedDocs;
  const visibleTrash = trash.filter((entry) => memberAccess(accessState, entry.document.id).canManage && entry.document.title.toLowerCase().includes(needle));
  const filteredDocs = visibleDocs.filter((document) => document.title.toLowerCase().includes(needle));
  const templates = listTemplates().filter((template) => template.title.toLowerCase().includes(needle));
  const visibleFolders = folders.filter((folder) => {
    if (workspaceOwner || folderAccess(accessState, folder.id).canView) return true;
    return allowedDocs.some((document) => documentFolders[document.id] === folder.id);
  });

  const toggleFolder = (folderId: string) => {
    setOpenFolders((current) => ({ ...current, [folderId]: !(current[folderId] ?? true) }));
  };

  return (
    <aside
      className={cn(
        "arbour-motion flex h-full shrink-0 flex-col overflow-hidden border-r border-line bg-panel/80",
        collapsed ? "w-0 border-r-0" : "w-[248px]",
      )}
      inert={collapsed || undefined}
    >
      <div className="flex items-center gap-2 px-3 pt-3">
        <Logo />
        <button type="button" className="min-w-0 text-left" onClick={() => setSettingsOpen(true)}>
          <span className="block font-display text-sm font-medium tracking-tight">Arbour</span>
          <span className="block truncate text-xs text-muted">{workspaceName}</span>
        </button>
      </div>
      <div className="flex gap-2 px-3 pt-3">
        <button
          type="button"
          className="flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-white hover:opacity-90"
          onClick={() => createMap()}
        >
          <FilePlus2 size={15} />
          New map
        </button>
        {workspaceOwner ? (
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-muted hover:bg-accent-soft hover:text-ink"
            aria-label="New folder"
            title="New folder"
            onClick={() => createFolder()}
          >
            <FolderPlus size={15} />
          </button>
        ) : null}
      </div>
      <label className="mx-3 mt-3 flex h-8 items-center gap-2 rounded-lg border border-line bg-canvas px-2 text-sm">
        <Search size={14} className="text-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          aria-label="Search maps"
          className="w-full bg-transparent outline-none"
        />
      </label>
      <nav className="mt-3 flex flex-col px-2" aria-label="Library">
        {VIEWS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={cn(
                "flex h-8 items-center gap-2 rounded-lg px-2 text-left text-sm",
                view === item.id ? "bg-accent-soft text-ink" : "text-muted hover:bg-accent-soft hover:text-ink",
              )}
              onClick={() => setView(item.id)}
            >
              <Icon size={15} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="mt-2 min-h-0 flex-1 overflow-auto px-2 pb-3">
        {view === "templates" ? (
          <ul className="space-y-1">
            {templates.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  className="w-full rounded-lg px-2 py-2 text-left hover:bg-accent-soft"
                  onClick={() => createFromTemplate(template.id)}
                >
                  <span className="block text-sm">{template.title}</span>
                  <span className="block text-xs text-muted">{template.description}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : view === "trash" ? (
          <ul className="space-y-1">
            {visibleTrash.map((entry) => (
              <li key={entry.document.id} className="rounded-lg px-2 py-2 hover:bg-accent-soft">
                <p className="truncate text-sm">{entry.document.title}</p>
                <div className="mt-1 flex gap-2 text-xs">
                  <button type="button" className="text-accent" onClick={() => restoreDocument(entry.document.id)}>
                    Restore
                  </button>
                  <button type="button" className="text-danger" onClick={() => deleteForever(entry.document.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
            {visibleTrash.length === 0 ? <p className="px-2 py-3 text-xs text-muted">Trash is empty.</p> : null}
          </ul>
        ) : view === "home" ? (
          <div className="space-y-2">
            {visibleFolders.map((folder) => {
              const open = openFolders[folder.id] ?? true;
              const folderDocs = filteredDocs.filter((document) => documentFolders[document.id] === folder.id);
              const manage = folderAccess(accessState, folder.id).canManage;
              if (needle && folderDocs.length === 0 && !folder.name.toLowerCase().includes(needle)) return null;
              return (
                <div key={folder.id} className="rounded-lg">
                  <div className="group flex items-center gap-0.5 rounded-lg px-1 py-1 hover:bg-accent-soft">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm"
                      onClick={() => toggleFolder(folder.id)}
                      aria-expanded={open}
                    >
                      {open ? <ChevronDown size={14} className="shrink-0 text-muted" /> : <ChevronRight size={14} className="shrink-0 text-muted" />}
                      <Folder size={14} className="shrink-0 text-accent" />
                      <span
                        className="truncate font-medium"
                        onDoubleClick={(event) => {
                          if (!manage) return;
                          event.stopPropagation();
                          const next = window.prompt("Folder name", folder.name);
                          if (next != null) renameFolder(folder.id, next);
                        }}
                      >
                        {folder.name}
                      </span>
                    </button>
                    {manage ? (
                      <>
                        <button
                          type="button"
                          aria-label={`Share ${folder.name}`}
                          className="rounded p-1 text-muted opacity-0 group-hover:opacity-100 hover:text-ink"
                          onClick={() => setShareFolderId(folder.id)}
                        >
                          <Share2 size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${folder.name}`}
                          className="rounded p-1 text-muted opacity-0 group-hover:opacity-100 hover:text-danger"
                          onClick={() => deleteFolder(folder.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    ) : null}
                  </div>
                  {open ? (
                    <ul className="ml-3 space-y-0.5 border-l border-line pl-2">
                      {folderDocs.map((document) => (
                        <MapRow
                          key={document.id}
                          document={document}
                          active={document.id === activeId}
                          accessState={accessState}
                          favorites={favorites}
                          folders={folders}
                          folderId={folder.id}
                          onOpen={openDocument}
                          onFavorite={toggleFavorite}
                          onDuplicate={duplicateDocument}
                          onTrash={trashDocument}
                          onMove={moveDocumentToFolder}
                        />
                      ))}
                      {folderDocs.length === 0 ? <p className="px-2 py-2 text-[11px] text-muted">No maps in this folder.</p> : null}
                    </ul>
                  ) : null}
                </div>
              );
            })}
            <ul className="space-y-0.5">
              {filteredDocs
                .filter((document) => !documentFolders[document.id])
                .map((document) => (
                  <MapRow
                    key={document.id}
                    document={document}
                    active={document.id === activeId}
                    accessState={accessState}
                    favorites={favorites}
                    folders={folders}
                    folderId={null}
                    onOpen={openDocument}
                    onFavorite={toggleFavorite}
                    onDuplicate={duplicateDocument}
                    onTrash={trashDocument}
                    onMove={moveDocumentToFolder}
                  />
                ))}
              {filteredDocs.length === 0 && visibleFolders.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted">{needle ? "Nothing matches." : "No maps for you in this view."}</p>
              ) : null}
            </ul>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {filteredDocs.map((document) => (
              <MapRow
                key={document.id}
                document={document}
                active={document.id === activeId}
                accessState={accessState}
                favorites={favorites}
                folders={folders}
                folderId={documentFolders[document.id] ?? null}
                onOpen={openDocument}
                onFavorite={toggleFavorite}
                onDuplicate={duplicateDocument}
                onTrash={trashDocument}
                onMove={moveDocumentToFolder}
              />
            ))}
            {filteredDocs.length === 0 ? <p className="px-2 py-3 text-xs text-muted">{needle ? "Nothing matches." : "No maps for you in this view."}</p> : null}
          </ul>
        )}
      </div>
      <button
        type="button"
        className="flex items-center gap-2 border-t border-line px-3 py-3 text-left text-sm"
        onClick={() => setSettingsOpen(true)}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[11px] text-panel">
          {displayName.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate">{displayName}</span>
          <span className="block text-xs text-muted">{actor ? workspaceRoleLabel(actor.workspaceRole) : "Account on this device"}</span>
        </span>
      </button>
    </aside>
  );
}

function MapRow({
  document,
  active,
  accessState,
  favorites,
  folders,
  folderId,
  onOpen,
  onFavorite,
  onDuplicate,
  onTrash,
  onMove,
}: {
  document: { id: string; title: string };
  active: boolean;
  accessState: Parameters<typeof memberAccess>[0];
  favorites: string[];
  folders: { id: string; name: string }[];
  folderId: string | null;
  onOpen: (id: string) => void;
  onFavorite: (id: string) => void;
  onDuplicate: (id: string) => void;
  onTrash: (id: string) => void;
  onMove: (documentId: string, folderId: string | null) => void;
}) {
  const access = memberAccess(accessState, document.id);
  return (
    <li>
      <div className={cn("group flex items-center rounded-lg pr-1", active && "bg-accent-soft")}>
        <button type="button" className="min-w-0 flex-1 px-2 py-1.5 text-left" onClick={() => onOpen(document.id)}>
          <span className="block truncate text-sm">{document.title}</span>
          <span className="block text-[11px] text-muted">{access.role ? documentRoleLabel(access.role) : ""}</span>
        </button>
        <button
          type="button"
          aria-label={favorites.includes(document.id) ? "Remove from favorites" : "Add to favorites"}
          className={cn("rounded p-1 text-muted hover:text-ink", favorites.includes(document.id) && "text-accent")}
          onClick={() => onFavorite(document.id)}
        >
          <Star size={13} fill={favorites.includes(document.id) ? "currentColor" : "none"} />
        </button>
        {access.canManage && folders.length > 0 ? (
          <select
            aria-label={`Move ${document.title} to folder`}
            className="max-w-16 appearance-none rounded bg-transparent text-[10px] text-muted opacity-0 group-hover:opacity-100"
            value={folderId ?? ""}
            onChange={(event) => onMove(document.id, event.target.value || null)}
          >
            <option value="">No folder</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          aria-label={`Duplicate ${document.title}`}
          className="rounded p-1 text-xs text-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-ink"
          onClick={() => onDuplicate(document.id)}
        >
          Copy
        </button>
        {access.canManage ? (
          <button
            type="button"
            aria-label={`Move ${document.title} to trash`}
            className="rounded p-1 text-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-danger"
            onClick={() => onTrash(document.id)}
          >
            <Trash2 size={13} />
          </button>
        ) : null}
      </div>
    </li>
  );
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="8" fill="var(--arbour-accent)" />
      <circle cx="10" cy="16" r="2.2" fill="#f7f5f1" />
      <circle cx="21" cy="9" r="2.2" fill="#f7f5f1" />
      <circle cx="21" cy="23" r="2.2" fill="#f7f5f1" />
      <path d="M12 16h5.2M18.8 10.2c-1.8.8-3.2 2.4-4.2 5.8M18.8 21.8c-1.8-.8-3.2-2.4-4.2-5.8" stroke="#f7f5f1" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
