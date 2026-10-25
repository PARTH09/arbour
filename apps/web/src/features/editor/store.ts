"use client";

import {
  applyCommand,
  bootstrapAccess,
  canEditDocument,
  canManageDocument,
  createDocument,
  createTemplateDocument,
  createWelcomeDocument,
  documentIssues,
  documentSchema,
  effectiveDocumentRole,
  effectiveFolderRole,
  layoutDocument,
  normalizeDocument,
  refreshDocumentStyles,
  type AccessGrant,
  type AccessMember,
  type Command,
  type DocumentRole,
  type FolderGrant,
  type MindMapDocument,
  type WorkspaceFolder,
  type WorkspaceRole,
} from "@arbour/mindmap-core";
import { create } from "zustand";

const STORAGE_KEY = "arbour.workspace.v1";
const HISTORY_LIMIT = 80;
const VIEW_ONLY = "You can view this map. Editors and owners can change it.";

export type Tool = "select" | "pan" | "connect";
export type SaveStatus = "saved" | "saving" | "offline" | "error";
export type LibraryView = "home" | "recent" | "favorites" | "trash" | "templates";

export interface TrashEntry {
  document: MindMapDocument;
  deletedAt: string;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface EditorState {
  ready: boolean;
  documents: MindMapDocument[];
  trash: TrashEntry[];
  activeId: string;
  favorites: string[];
  recents: string[];
  displayName: string;
  workspaceName: string;
  members: AccessMember[];
  grants: AccessGrant[];
  folders: WorkspaceFolder[];
  folderGrants: FolderGrant[];
  documentFolders: Record<string, string>;
  activeMemberId: string;
  shareFolderId: string | null;
  theme: "light" | "dark";
  sidebarCollapsed: boolean;
  showMinimap: boolean;
  showGrid: boolean;
  showOutline: boolean;
  viewports: Record<string, Viewport>;
  selection: string[];
  selectedEdgeId: string | null;
  editingId: string | null;
  editSelectAll: boolean;
  past: MindMapDocument[];
  future: MindMapDocument[];
  coalesceKey: string | null;
  tool: Tool;
  saveStatus: SaveStatus;
  banner: string | null;
  query: string;
  libraryView: LibraryView;
  shortcutsOpen: boolean;
  shareOpen: boolean;
  settingsOpen: boolean;
  imageOpen: boolean;
  zoom: number;
  hydrate: () => void;
  dispatch: (command: Command, options?: { coalesceKey?: string; edit?: boolean; selectAll?: boolean }) => void;
  undo: () => void;
  redo: () => void;
  setSelection: (ids: string[]) => void;
  selectEdge: (id: string | null) => void;
  startEditing: (id: string, selectAll?: boolean) => void;
  stopEditing: () => void;
  setTool: (tool: Tool) => void;
  setZoom: (zoom: number) => void;
  setViewport: (id: string, viewport: Viewport) => void;
  measureNode: (id: string, width: number, height: number) => void;
  openDocument: (id: string) => void;
  createMap: (title?: string, rootText?: string) => void;
  createFromTemplate: (templateId: string) => void;
  duplicateDocument: (id: string) => void;
  renameDocument: (id: string, title: string) => void;
  renameWorkspace: (workspaceName: string, displayName: string) => void;
  addMember: (name: string) => void;
  setWorkspaceRole: (memberId: string, role: WorkspaceRole) => void;
  removeMember: (memberId: string) => void;
  setDocumentRole: (documentId: string, memberId: string, role: DocumentRole | "none") => void;
  createFolder: (name?: string) => void;
  renameFolder: (folderId: string, name: string) => void;
  deleteFolder: (folderId: string) => void;
  moveDocumentToFolder: (documentId: string, folderId: string | null) => void;
  setFolderRole: (folderId: string, memberId: string, role: DocumentRole | "none") => void;
  setShareFolderId: (folderId: string | null) => void;
  switchMember: (memberId: string) => void;
  toggleFavorite: (id: string) => void;
  trashDocument: (id: string) => void;
  restoreDocument: (id: string) => void;
  deleteForever: (id: string) => void;
  setTheme: (theme: "light" | "dark") => void;
  setLibraryView: (view: LibraryView) => void;
  setQuery: (query: string) => void;
  toggleSidebar: () => void;
  toggleMinimap: () => void;
  toggleGrid: () => void;
  toggleOutline: () => void;
  setShortcutsOpen: (open: boolean) => void;
  setShareOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setImageOpen: (open: boolean) => void;
  showBanner: (message: string) => void;
  importDocument: (document: MindMapDocument) => void;
}

const measurePasses = new Map<string, number>();
let measureBuffer: Record<string, { width: number; height: number }> = {};
let measureTimer: number | undefined;
let saveTimer: number | undefined;
let documentDirty = false;

function activeDocument(state: EditorState): MindMapDocument | null {
  return state.documents.find((document) => document.id === state.activeId) ?? null;
}

function applyThemeClass(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function serialize(state: EditorState) {
  return {
    version: 1 as const,
    documents: state.documents,
    trash: state.trash,
    activeId: state.activeId,
    favorites: state.favorites,
    recents: state.recents,
    displayName: state.displayName,
    workspaceName: state.workspaceName,
    members: state.members,
    grants: state.grants,
    folders: state.folders,
    folderGrants: state.folderGrants,
    documentFolders: state.documentFolders,
    activeMemberId: state.activeMemberId,
    theme: state.theme,
    sidebarCollapsed: state.sidebarCollapsed,
    showMinimap: state.showMinimap,
    showGrid: state.showGrid,
    showOutline: state.showOutline,
    viewports: state.viewports,
  };
}

function schedulePersist(showStatus: boolean) {
  if (typeof window === "undefined") return;
  if (showStatus) {
    documentDirty = true;
    useEditor.setState({ saveStatus: navigator.onLine ? "saving" : "offline" });
  }
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const state = useEditor.getState();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(state)));
      if (documentDirty) {
        useEditor.setState({ saveStatus: navigator.onLine ? "saved" : "offline" });
        documentDirty = false;
      }
    } catch {
      useEditor.setState({ saveStatus: "error", banner: "This browser could not save the map." });
    }
  }, 400);
}

function restoreDocument(input: unknown): MindMapDocument | null {
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) return null;
  if (documentIssues(parsed.data).length === 0) return refreshDocumentStyles(parsed.data);
  const normalized = normalizeDocument(parsed.data);
  return normalized.ok ? normalized.document : null;
}

function remember(recents: string[], id: string) {
  return [id, ...recents.filter((item) => item !== id)].slice(0, 12);
}

function resetSession() {
  measurePasses.clear();
  return {
    selection: [] as string[],
    selectedEdgeId: null,
    editingId: null,
    past: [] as MindMapDocument[],
    future: [] as MindMapDocument[],
    coalesceKey: null,
  };
}

export function memberAccess(
  state: Pick<EditorState, "members" | "grants" | "folderGrants" | "documentFolders" | "activeMemberId">,
  documentId: string,
) {
  const member = state.members.find((item) => item.id === state.activeMemberId);
  const folderId = state.documentFolders[documentId] ?? null;
  const role = effectiveDocumentRole(member, state.grants, documentId, {
    folderId,
    folderGrants: state.folderGrants,
  });
  return {
    member,
    role,
    canView: role !== null,
    canEdit: canEditDocument(role),
    canManage: canManageDocument(role),
  };
}

export function folderAccess(
  state: Pick<EditorState, "members" | "folderGrants" | "activeMemberId">,
  folderId: string,
) {
  const member = state.members.find((item) => item.id === state.activeMemberId);
  const role = effectiveFolderRole(member, state.folderGrants, folderId);
  return {
    member,
    role,
    canView: role !== null,
    canEdit: canEditDocument(role),
    canManage: canManageDocument(role),
  };
}

function readMembers(value: unknown): AccessMember[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const member = item as { id?: unknown; name?: unknown; workspaceRole?: unknown };
    if (typeof member.id !== "string" || typeof member.name !== "string") return [];
    if (member.workspaceRole !== "owner" && member.workspaceRole !== "member") return [];
    return [{ id: member.id, name: member.name, workspaceRole: member.workspaceRole }];
  });
}

function readGrants(value: unknown): AccessGrant[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const grant = item as { documentId?: unknown; memberId?: unknown; role?: unknown };
    if (typeof grant.documentId !== "string" || typeof grant.memberId !== "string") return [];
    if (grant.role !== "owner" && grant.role !== "editor" && grant.role !== "viewer") return [];
    return [{ documentId: grant.documentId, memberId: grant.memberId, role: grant.role }];
  });
}

function readFolders(value: unknown): WorkspaceFolder[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const folder = item as { id?: unknown; name?: unknown };
    if (typeof folder.id !== "string" || typeof folder.name !== "string") return [];
    const name = folder.name.trim().slice(0, 60);
    if (!name) return [];
    return [{ id: folder.id, name }];
  });
}

function readFolderGrants(value: unknown): FolderGrant[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const grant = item as { folderId?: unknown; memberId?: unknown; role?: unknown };
    if (typeof grant.folderId !== "string" || typeof grant.memberId !== "string") return [];
    if (grant.role !== "owner" && grant.role !== "editor" && grant.role !== "viewer") return [];
    return [{ folderId: grant.folderId, memberId: grant.memberId, role: grant.role }];
  });
}

function readDocumentFolders(value: unknown, folders: WorkspaceFolder[], documentIds: Set<string>): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const folderIds = new Set(folders.map((folder) => folder.id));
  const next: Record<string, string> = {};
  for (const [documentId, folderId] of Object.entries(value as Record<string, unknown>)) {
    if (!documentIds.has(documentId) || typeof folderId !== "string" || !folderIds.has(folderId)) continue;
    next[documentId] = folderId;
  }
  return next;
}

function accessFrom(input: {
  members?: unknown;
  grants?: unknown;
  folders?: unknown;
  folderGrants?: unknown;
  activeMemberId?: unknown;
  displayName?: string;
}) {
  return bootstrapAccess({
    members: readMembers(input.members),
    grants: readGrants(input.grants),
    folders: readFolders(input.folders),
    folderGrants: readFolderGrants(input.folderGrants),
    activeMemberId: typeof input.activeMemberId === "string" ? input.activeMemberId : undefined,
    displayName: input.displayName || "You",
    createId: () => crypto.randomUUID(),
  });
}

function ownsFolderGrant(grants: FolderGrant[], folderId: string, memberId: string, role: DocumentRole): FolderGrant[] {
  return [...grants.filter((grant) => !(grant.folderId === folderId && grant.memberId === memberId)), { folderId, memberId, role }];
}

function blockEdit(state: EditorState) {
  if (memberAccess(state, state.activeId).canEdit) return false;
  if (state.banner !== VIEW_ONLY) useEditor.setState({ banner: VIEW_ONLY });
  return true;
}

function ownsGrant(grants: AccessGrant[], documentId: string, memberId: string, role: DocumentRole): AccessGrant[] {
  return [...grants.filter((grant) => !(grant.documentId === documentId && grant.memberId === memberId)), { documentId, memberId, role }];
}

function firstVisibleId(
  state: Pick<EditorState, "members" | "grants" | "folderGrants" | "documentFolders" | "activeMemberId" | "documents">,
  preferred: string,
) {
  if (preferred && memberAccess(state, preferred).canView) return preferred;
  return state.documents.find((document) => memberAccess(state, document.id).canView)?.id ?? "";
}

export const useEditor = create<EditorState>((set, get) => ({
  ready: false,
  documents: [],
  trash: [],
  activeId: "",
  favorites: [],
  recents: [],
  displayName: "You",
  workspaceName: "Personal",
  members: [],
  grants: [],
  folders: [],
  folderGrants: [],
  documentFolders: {},
  activeMemberId: "",
  theme: "light",
  sidebarCollapsed: false,
  showMinimap: true,
  showGrid: false,
  showOutline: false,
  viewports: {},
  selection: [],
  selectedEdgeId: null,
  editingId: null,
  editSelectAll: true,
  past: [],
  future: [],
  coalesceKey: null,
  tool: "select",
  saveStatus: "saved",
  banner: null,
  query: "",
  libraryView: "home",
  shortcutsOpen: false,
  shareOpen: false,
  shareFolderId: null,
  settingsOpen: false,
  imageOpen: false,
  zoom: 1,

  hydrate: () => {
    if (get().ready) return;
    let next: Partial<EditorState> = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { version?: number; documents?: unknown[] };
        if (saved.version === 1 && Array.isArray(saved.documents)) {
          const documents = saved.documents
            .map((document) => restoreDocument(document))
            .filter((document): document is MindMapDocument => Boolean(document));
          const trash = Array.isArray((saved as { trash?: unknown }).trash)
            ? ((saved as { trash: { document: unknown; deletedAt?: string }[] }).trash
                .map((entry) => {
                  const document = restoreDocument(entry.document);
                  return document ? { document, deletedAt: entry.deletedAt || new Date().toISOString() } : null;
                })
                .filter((entry): entry is TrashEntry => Boolean(entry)))
            : [];
          if (documents.length) {
            const data = saved as ReturnType<typeof serialize>;
            const access = accessFrom(data);
            const documentIds = new Set(documents.map((document) => document.id));
            const documentFolders = readDocumentFolders(
              (saved as { documentFolders?: unknown }).documentFolders,
              access.folders,
              documentIds,
            );
            const preferred = documents.some((document) => document.id === data.activeId) ? data.activeId : documents[0].id;
            next = {
              documents,
              trash,
              ...access,
              documentFolders,
              activeId: firstVisibleId({ ...access, documents, documentFolders }, preferred),
              favorites: (data.favorites || []).filter((id) => documents.some((document) => document.id === id)),
              recents: (data.recents || []).filter((id) => documents.some((document) => document.id === id)),
              workspaceName: data.workspaceName || "Personal",
              theme: data.theme === "dark" ? "dark" : "light",
              sidebarCollapsed: Boolean(data.sidebarCollapsed),
              showMinimap: data.showMinimap !== false,
              showGrid: Boolean(data.showGrid),
              showOutline: Boolean(data.showOutline),
              viewports: data.viewports || {},
              saveStatus: navigator.onLine ? "saved" : "offline",
            };
          }
        }
      }
    } catch {
      next = {};
    }

    if (!next.documents?.length) {
      const welcome = createWelcomeDocument();
      const access = accessFrom({ displayName: next.displayName || "You" });
      next = {
        ...next,
        ...access,
        documents: [welcome],
        grants: ownsGrant(access.grants, welcome.id, access.activeMemberId, "owner"),
        activeId: welcome.id,
        recents: [welcome.id],
        saveStatus: "saving",
      };
      set({ ...get(), ...next, ready: true });
      applyThemeClass(next.theme || "light");
      schedulePersist(true);
      return;
    }

    set({ ...get(), ...next, ready: true });
    applyThemeClass(next.theme || "light");
    // Persist repaired topic fills (older white backgrounds) and any access bootstrap.
    schedulePersist(true);
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        if (useEditor.getState().saveStatus === "offline") useEditor.setState({ saveStatus: "saved" });
      });
      window.addEventListener("offline", () => {
        const status = useEditor.getState().saveStatus;
        if (status === "saved" || status === "saving") useEditor.setState({ saveStatus: "offline" });
      });
    }
  },

  dispatch: (command, options) => {
    const state = get();
    const current = activeDocument(state);
    if (!current || blockEdit(state)) return;
    const coalesce = Boolean(options?.coalesceKey && options.coalesceKey === state.coalesceKey);
    const result = applyCommand(current, command);
    if (!result.changed) {
      if (result.error) set({ banner: result.error });
      return;
    }
    measurePasses.clear();
    const focuses = new Set([
      "addChild",
      "addSibling",
      "addParent",
      "addFloating",
      "duplicate",
      "pasteOutline",
      "pasteSubtree",
      "reparent",
      "promote",
    ]);
    let selection = state.selection.filter((id) => result.document.nodes[id]);
    if (result.focusId && focuses.has(command.type)) selection = [result.focusId];
    let editingId: string | null = null;
    if (options?.edit && result.focusId) editingId = result.focusId;
    else if (command.type === "rename") editingId = state.editingId;
    set({
      documents: state.documents.map((document) => (document.id === current.id ? result.document : document)),
      past: coalesce ? state.past : [...state.past, current].slice(-HISTORY_LIMIT),
      future: [],
      coalesceKey: options?.coalesceKey ?? null,
      selection,
      editingId,
      editSelectAll: options?.selectAll ?? true,
      selectedEdgeId:
        command.type === "deleteEdges"
          ? null
          : command.type === "patchEdges" || command.type === "addLink"
            ? state.selectedEdgeId
            : selection.length
              ? null
              : state.selectedEdgeId,
      banner: null,
    });
    schedulePersist(true);
  },

  undo: () => {
    const state = get();
    const current = activeDocument(state);
    const previous = state.past.at(-1);
    if (!current || !previous || blockEdit(state)) return;
    measurePasses.clear();
    set({
      ...resetSession(),
      selection: state.selection.filter((id) => previous.nodes[id]),
      documents: state.documents.map((document) => (document.id === current.id ? previous : document)),
      past: state.past.slice(0, -1),
      future: [current, ...state.future].slice(0, HISTORY_LIMIT),
    });
    schedulePersist(true);
  },

  redo: () => {
    const state = get();
    const current = activeDocument(state);
    const [next, ...rest] = state.future;
    if (!current || !next || blockEdit(state)) return;
    measurePasses.clear();
    set({
      ...resetSession(),
      selection: state.selection.filter((id) => next.nodes[id]),
      documents: state.documents.map((document) => (document.id === current.id ? next : document)),
      past: [...state.past, current].slice(-HISTORY_LIMIT),
      future: rest,
    });
    schedulePersist(true);
  },

  setSelection: (ids) => {
    const state = get();
    if (state.selection.length === ids.length && state.selection.every((id, index) => id === ids[index])) return;
    set({ selection: ids, selectedEdgeId: ids.length ? null : state.selectedEdgeId });
  },

  selectEdge: (id) => set({ selectedEdgeId: id, selection: id ? [] : get().selection }),

  startEditing: (id, selectAll = true) => {
    const state = get();
    if (!activeDocument(state)?.nodes[id] || blockEdit(state)) return;
    set({ editingId: id, editSelectAll: selectAll, selection: [id], selectedEdgeId: null });
  },

  stopEditing: () => set({ editingId: null }),

  setTool: (tool) => {
    const state = get();
    if (tool === "connect" && blockEdit(state)) return;
    set({ tool, editingId: tool === "select" ? state.editingId : null });
  },

  setZoom: (zoom) => {
    if (Math.abs(get().zoom - zoom) < 0.001) return;
    set({ zoom });
  },

  setViewport: (id, viewport) => {
    set({ viewports: { ...get().viewports, [id]: viewport }, zoom: viewport.zoom });
    schedulePersist(false);
  },

  measureNode: (id, width, height) => {
    if (width < 8 || height < 8) return;
    const current = activeDocument(get());
    const node = current?.nodes[id];
    if (!node) return;
    if (Math.abs(node.width - width) < 2 && Math.abs(node.height - height) < 2) return;
    if ((measurePasses.get(id) ?? 0) > 6) return;
    measureBuffer[id] = { width: Math.round(width), height: Math.round(height) };
    if (typeof window === "undefined") return;
    window.clearTimeout(measureTimer);
    measureTimer = window.setTimeout(() => {
      const sizes = measureBuffer;
      measureBuffer = {};
      const state = get();
      const doc = activeDocument(state);
      if (!doc || !memberAccess(state, doc.id).canEdit) return;
      const next = structuredClone(doc);
      let changed = false;
      for (const [nodeId, size] of Object.entries(sizes)) {
        const topic = next.nodes[nodeId];
        if (!topic) continue;
        if (Math.abs(topic.width - size.width) < 2 && Math.abs(topic.height - size.height) < 2) continue;
        topic.width = size.width;
        topic.height = size.height;
        measurePasses.set(nodeId, (measurePasses.get(nodeId) ?? 0) + 1);
        changed = true;
      }
      if (!changed) return;
      layoutDocument(next);
      set({
        documents: state.documents.map((document) => (document.id === next.id ? next : document)),
      });
      schedulePersist(true);
    }, 40);
  },

  openDocument: (id) => {
    const state = get();
    if (!state.documents.some((document) => document.id === id) || !memberAccess(state, id).canView) return;
    measurePasses.clear();
    set({ activeId: id, recents: remember(state.recents, id), libraryView: state.libraryView === "templates" ? "home" : state.libraryView, ...resetSession() });
    schedulePersist(false);
  },

  createMap: (title = "Untitled map", rootText = "Central topic") => {
    const document = createDocument({ title, rootText });
    const state = get();
    measurePasses.clear();
    set({
      documents: [document, ...state.documents],
      grants: ownsGrant(state.grants, document.id, state.activeMemberId, "owner"),
      activeId: document.id,
      recents: remember(state.recents, document.id),
      libraryView: "home",
      ...resetSession(),
    });
    schedulePersist(true);
  },

  createFromTemplate: (templateId) => {
    const document = createTemplateDocument(templateId);
    if (!document) return;
    const state = get();
    measurePasses.clear();
    set({
      documents: [document, ...state.documents],
      grants: ownsGrant(state.grants, document.id, state.activeMemberId, "owner"),
      activeId: document.id,
      recents: remember(state.recents, document.id),
      libraryView: "home",
      ...resetSession(),
    });
    schedulePersist(true);
  },

  duplicateDocument: (id) => {
    const state = get();
    const source = state.documents.find((document) => document.id === id);
    if (!source || !memberAccess(state, id).canView) return;
    const copy = structuredClone(source);
    copy.id = crypto.randomUUID();
    copy.title = `${source.title} copy`.slice(0, 120);
    copy.updatedAt = new Date().toISOString();
    set({
      documents: [copy, ...state.documents],
      grants: ownsGrant(state.grants, copy.id, state.activeMemberId, "owner"),
      activeId: copy.id,
      recents: remember(state.recents, copy.id),
      ...resetSession(),
    });
    schedulePersist(true);
  },

  renameDocument: (id, title) => {
    const state = get();
    if (!memberAccess(state, id).canEdit) {
      set({ banner: "You need edit access to rename this map." });
      return;
    }
    const next = title.trim().slice(0, 120) || "Untitled map";
    set({
      documents: state.documents.map((document) =>
        document.id === id ? { ...document, title: next, updatedAt: new Date().toISOString() } : document,
      ),
    });
    schedulePersist(true);
  },

  renameWorkspace: (workspaceName, displayName) => {
    const state = get();
    const name = displayName.trim().slice(0, 40) || "You";
    const isOwner = state.members.find((member) => member.id === state.activeMemberId)?.workspaceRole === "owner";
    set({
      workspaceName: isOwner ? workspaceName.trim().slice(0, 40) || "Personal" : state.workspaceName,
      displayName: name,
      members: state.members.map((member) => (member.id === state.activeMemberId ? { ...member, name } : member)),
    });
    schedulePersist(true);
  },

  addMember: (name) => {
    const state = get();
    const actor = state.members.find((member) => member.id === state.activeMemberId);
    const trimmed = name.trim().slice(0, 40);
    if (actor?.workspaceRole !== "owner") {
      set({ banner: "Only a workspace owner can add people." });
      return;
    }
    if (!trimmed) return;
    if (state.members.length >= 24) {
      set({ banner: "This workspace already has 24 people." });
      return;
    }
    set({
      members: [...state.members, { id: crypto.randomUUID(), name: trimmed, workspaceRole: "member" }],
      banner: null,
    });
    schedulePersist(true);
  },

  setWorkspaceRole: (memberId, role) => {
    const state = get();
    const actor = state.members.find((member) => member.id === state.activeMemberId);
    const target = state.members.find((member) => member.id === memberId);
    if (actor?.workspaceRole !== "owner" || !target) {
      set({ banner: "Only a workspace owner can change roles." });
      return;
    }
    const owners = state.members.filter((member) => member.workspaceRole === "owner");
    if (target.workspaceRole === "owner" && role === "member" && owners.length === 1) {
      set({ banner: "The workspace needs an owner." });
      return;
    }
    const members = state.members.map((member) => (member.id === memberId ? { ...member, workspaceRole: role } : member));
    const next = { ...state, members };
    set({
      members,
      activeId: firstVisibleId(next, state.activeId),
      banner: null,
      ...resetSession(),
    });
    schedulePersist(true);
  },

  removeMember: (memberId) => {
    const state = get();
    const actor = state.members.find((member) => member.id === state.activeMemberId);
    const target = state.members.find((member) => member.id === memberId);
    if (actor?.workspaceRole !== "owner" || !target) {
      set({ banner: "Only a workspace owner can remove people." });
      return;
    }
    const owners = state.members.filter((member) => member.workspaceRole === "owner");
    if (target.workspaceRole === "owner" && owners.length === 1) {
      set({ banner: "The workspace needs an owner." });
      return;
    }
    const members = state.members.filter((member) => member.id !== memberId);
    const grants = state.grants.filter((grant) => grant.memberId !== memberId);
    const folderGrants = state.folderGrants.filter((grant) => grant.memberId !== memberId);
    const activeMemberId = memberId === state.activeMemberId ? members.find((member) => member.workspaceRole === "owner")?.id || members[0].id : state.activeMemberId;
    const displayName = members.find((member) => member.id === activeMemberId)?.name || state.displayName;
    const next = { ...state, members, grants, folderGrants, activeMemberId };
    set({
      members,
      grants,
      folderGrants,
      activeMemberId,
      displayName,
      activeId: firstVisibleId(next, state.activeId),
      banner: null,
      ...resetSession(),
    });
    schedulePersist(true);
  },

  setDocumentRole: (documentId, memberId, role) => {
    const state = get();
    if (!state.documents.some((document) => document.id === documentId) || !memberAccess(state, documentId).canManage) {
      set({ banner: "Only an owner can change who has access." });
      return;
    }
    const member = state.members.find((item) => item.id === memberId);
    if (!member || member.workspaceRole === "owner") return;
    const grants = role === "none"
      ? state.grants.filter((grant) => !(grant.documentId === documentId && grant.memberId === memberId))
      : ownsGrant(state.grants, documentId, memberId, role);
    const next = { ...state, grants };
    const stillVisible = memberAccess(next, state.activeId).canView;
    set({
      grants,
      banner: null,
      ...(stillVisible
        ? {}
        : {
            activeId: firstVisibleId(next, ""),
            shareOpen: false,
            ...resetSession(),
          }),
    });
    schedulePersist(true);
  },

  createFolder: (name = "New folder") => {
    const state = get();
    const actor = state.members.find((member) => member.id === state.activeMemberId);
    if (actor?.workspaceRole !== "owner") {
      set({ banner: "Only a workspace owner can create folders." });
      return;
    }
    const trimmed = name.trim().slice(0, 60) || "New folder";
    if (state.folders.length >= 40) {
      set({ banner: "This workspace already has 40 folders." });
      return;
    }
    const folder: WorkspaceFolder = { id: crypto.randomUUID(), name: trimmed };
    set({
      folders: [...state.folders, folder],
      folderGrants: ownsFolderGrant(state.folderGrants, folder.id, state.activeMemberId, "owner"),
      banner: null,
    });
    schedulePersist(true);
  },

  renameFolder: (folderId, name) => {
    const state = get();
    if (!folderAccess(state, folderId).canManage) {
      set({ banner: "Only an owner can rename this folder." });
      return;
    }
    const trimmed = name.trim().slice(0, 60);
    if (!trimmed) return;
    set({
      folders: state.folders.map((folder) => (folder.id === folderId ? { ...folder, name: trimmed } : folder)),
      banner: null,
    });
    schedulePersist(true);
  },

  deleteFolder: (folderId) => {
    const state = get();
    if (!folderAccess(state, folderId).canManage) {
      set({ banner: "Only an owner can delete this folder." });
      return;
    }
    const documentFolders = { ...state.documentFolders };
    for (const [documentId, folder] of Object.entries(documentFolders)) {
      if (folder === folderId) delete documentFolders[documentId];
    }
    set({
      folders: state.folders.filter((folder) => folder.id !== folderId),
      folderGrants: state.folderGrants.filter((grant) => grant.folderId !== folderId),
      documentFolders,
      shareFolderId: state.shareFolderId === folderId ? null : state.shareFolderId,
      banner: null,
    });
    schedulePersist(true);
  },

  moveDocumentToFolder: (documentId, folderId) => {
    const state = get();
    if (!state.documents.some((document) => document.id === documentId) || !memberAccess(state, documentId).canManage) {
      set({ banner: "Only an owner can move this map." });
      return;
    }
    if (folderId && !state.folders.some((folder) => folder.id === folderId)) return;
    if (folderId && !folderAccess(state, folderId).canManage && state.members.find((member) => member.id === state.activeMemberId)?.workspaceRole !== "owner") {
      set({ banner: "Only a folder owner can put maps here." });
      return;
    }
    const documentFolders = { ...state.documentFolders };
    if (folderId) documentFolders[documentId] = folderId;
    else delete documentFolders[documentId];
    set({ documentFolders, banner: null });
    schedulePersist(true);
  },

  setFolderRole: (folderId, memberId, role) => {
    const state = get();
    if (!state.folders.some((folder) => folder.id === folderId) || !folderAccess(state, folderId).canManage) {
      set({ banner: "Only an owner can change who has access to this folder." });
      return;
    }
    const member = state.members.find((item) => item.id === memberId);
    if (!member || member.workspaceRole === "owner") return;
    const folderGrants = role === "none"
      ? state.folderGrants.filter((grant) => !(grant.folderId === folderId && grant.memberId === memberId))
      : ownsFolderGrant(state.folderGrants, folderId, memberId, role);
    const next = { ...state, folderGrants };
    const stillVisible = memberAccess(next, state.activeId).canView;
    set({
      folderGrants,
      banner: null,
      ...(stillVisible
        ? {}
        : {
            activeId: firstVisibleId(next, ""),
            shareOpen: false,
            shareFolderId: null,
            ...resetSession(),
          }),
    });
    schedulePersist(true);
  },

  setShareFolderId: (shareFolderId) => set({ shareFolderId, shareOpen: shareFolderId !== null }),

  switchMember: (memberId) => {
    const state = get();
    const member = state.members.find((item) => item.id === memberId);
    if (!member) return;
    const next = { ...state, activeMemberId: member.id };
    set({
      activeMemberId: member.id,
      displayName: member.name,
      activeId: firstVisibleId(next, state.activeId),
      tool: "select",
      banner: null,
      ...resetSession(),
    });
    schedulePersist(false);
  },

  toggleFavorite: (id) => {
    const favorites = get().favorites.includes(id)
      ? get().favorites.filter((item) => item !== id)
      : [id, ...get().favorites];
    set({ favorites });
    schedulePersist(false);
  },

  trashDocument: (id) => {
    const state = get();
    const document = state.documents.find((item) => item.id === id);
    if (!document || !memberAccess(state, id).canManage) {
      set({ banner: "Only an owner can move this map to trash." });
      return;
    }
    let documents = state.documents.filter((item) => item.id !== id);
    let grants = state.grants;
    let activeId = state.activeId === id ? "" : state.activeId;
    if (!documents.length) {
      const blank = createDocument({ title: "Untitled map", rootText: "Central topic" });
      documents = [blank];
      grants = ownsGrant(grants, blank.id, state.activeMemberId, "owner");
      activeId = blank.id;
    } else if (!activeId || !documents.some((item) => item.id === activeId) || !memberAccess(state, activeId).canView) {
      activeId = firstVisibleId({ ...state, documents }, documents[0].id);
    }
    const documentFolders = { ...state.documentFolders };
    delete documentFolders[id];
    measurePasses.clear();
    set({
      documents,
      grants,
      documentFolders,
      activeId,
      trash: [{ document, deletedAt: new Date().toISOString() }, ...state.trash].slice(0, 50),
      favorites: state.favorites.filter((item) => item !== id),
      recents: state.recents.filter((item) => item !== id),
      ...resetSession(),
    });
    schedulePersist(true);
  },

  restoreDocument: (id) => {
    const state = get();
    const entry = state.trash.find((item) => item.document.id === id);
    if (!entry || !memberAccess(state, id).canManage) return;
    set({
      trash: get().trash.filter((item) => item.document.id !== id),
      documents: [entry.document, ...get().documents.filter((document) => document.id !== id)],
      activeId: entry.document.id,
      recents: remember(get().recents, entry.document.id),
      libraryView: "home",
      ...resetSession(),
    });
    schedulePersist(true);
  },

  deleteForever: (id) => {
    const state = get();
    if (!memberAccess(state, id).canManage) return;
    const documentFolders = { ...state.documentFolders };
    delete documentFolders[id];
    set({
      trash: state.trash.filter((item) => item.document.id !== id),
      grants: state.grants.filter((grant) => grant.documentId !== id),
      documentFolders,
    });
    schedulePersist(true);
  },

  setTheme: (theme) => {
    applyThemeClass(theme);
    set({ theme });
    schedulePersist(false);
  },

  setLibraryView: (libraryView) => set({ libraryView }),
  setQuery: (query) => set({ query }),
  toggleSidebar: () => {
    set({ sidebarCollapsed: !get().sidebarCollapsed });
    schedulePersist(false);
  },
  toggleMinimap: () => {
    set({ showMinimap: !get().showMinimap });
    schedulePersist(false);
  },
  toggleGrid: () => {
    set({ showGrid: !get().showGrid });
    schedulePersist(false);
  },
  toggleOutline: () => {
    set({ showOutline: !get().showOutline });
    schedulePersist(false);
  },
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setShareOpen: (shareOpen) => set({ shareOpen, shareFolderId: shareOpen ? get().shareFolderId : null }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setImageOpen: (imageOpen) => set({ imageOpen }),
  showBanner: (banner) => set({ banner }),

  importDocument: (document) => {
    const current = activeDocument(get());
    if (!current) return;
    const replacement = { ...document, id: current.id };
    get().dispatch({ type: "replaceDocument", document: replacement });
  },
}));

export function useActiveDocument() {
  return useEditor((state) => state.documents.find((document) => document.id === state.activeId) ?? null);
}

export function useDocumentAccess(documentId?: string) {
  const members = useEditor((state) => state.members);
  const grants = useEditor((state) => state.grants);
  const folderGrants = useEditor((state) => state.folderGrants);
  const documentFolders = useEditor((state) => state.documentFolders);
  const activeMemberId = useEditor((state) => state.activeMemberId);
  const activeId = useEditor((state) => state.activeId);
  return memberAccess(
    { members, grants, folderGrants, documentFolders, activeMemberId },
    documentId ?? activeId,
  );
}
