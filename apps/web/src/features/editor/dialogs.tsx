"use client";

import {
  createsCycle,
  documentRoleLabel,
  isNodeVisible,
  toOutline,
  workspaceRoleLabel,
  type DocumentRole,
  type WorkspaceRole,
} from "@arbour/mindmap-core";
import { useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/ui/dialog";
import { downloadText, fileSlug } from "@/lib/utils";
import { HelpCenter } from "@/features/editor/help-center";
import { folderAccess, useActiveDocument, useDocumentAccess, useEditor } from "@/features/editor/store";
import {
  TRANSLATE_LANGUAGES,
  translateTexts,
  type TranslateLanguage,
} from "@/features/editor/translate";

export function Dialogs() {
  const document = useActiveDocument();
  const shareOpen = useEditor((state) => state.shareOpen);
  const shareFolderId = useEditor((state) => state.shareFolderId);
  const settingsOpen = useEditor((state) => state.settingsOpen);
  const translateOpen = useEditor((state) => state.translateOpen);
  const moveNodeId = useEditor((state) => state.moveNodeId);
  const setShareOpen = useEditor((state) => state.setShareOpen);
  const setSettingsOpen = useEditor((state) => state.setSettingsOpen);
  const setTranslateOpen = useEditor((state) => state.setTranslateOpen);
  const setMoveNodeId = useEditor((state) => state.setMoveNodeId);
  const dispatch = useEditor((state) => state.dispatch);
  const workspaceName = useEditor((state) => state.workspaceName);
  const displayName = useEditor((state) => state.displayName);
  const renameWorkspace = useEditor((state) => state.renameWorkspace);
  const showBanner = useEditor((state) => state.showBanner);
  const members = useEditor((state) => state.members);
  const grants = useEditor((state) => state.grants);
  const folders = useEditor((state) => state.folders);
  const folderGrants = useEditor((state) => state.folderGrants);
  const activeMemberId = useEditor((state) => state.activeMemberId);
  const addMember = useEditor((state) => state.addMember);
  const setWorkspaceRole = useEditor((state) => state.setWorkspaceRole);
  const removeMember = useEditor((state) => state.removeMember);
  const setDocumentRole = useEditor((state) => state.setDocumentRole);
  const setFolderRole = useEditor((state) => state.setFolderRole);
  const switchMember = useEditor((state) => state.switchMember);
  const access = useDocumentAccess();
  const shareFolder = folders.find((folder) => folder.id === shareFolderId) ?? null;
  const folderShare = shareFolder
    ? folderAccess({ members, folderGrants, activeMemberId }, shareFolder.id)
    : null;
  const [workspace, setWorkspace] = useState(workspaceName);
  const [name, setName] = useState(displayName);
  const [person, setPerson] = useState("");
  const [grantMemberId, setGrantMemberId] = useState("");
  const [grantRole, setGrantRole] = useState<DocumentRole>("viewer");
  const [targetLang, setTargetLang] = useState<TranslateLanguage>("hi");
  const [sourceLang, setSourceLang] = useState<TranslateLanguage | "auto">("auto");
  const [translating, setTranslating] = useState(false);
  const [translateProgress, setTranslateProgress] = useState("");
  const [moveParentId, setMoveParentId] = useState("");
  const actor = members.find((member) => member.id === activeMemberId);
  const workspaceOwner = actor?.workspaceRole === "owner";
  const moveNode = document && moveNodeId ? document.nodes[moveNodeId] : null;
  const moveTargets = useMemo(() => {
    if (!document || !moveNodeId) return [];
    return Object.values(document.nodes)
      .filter((node) => isNodeVisible(document, node.id))
      .filter((node) => node.id !== moveNodeId)
      .filter((node) => !createsCycle(document, moveNodeId, node.id))
      .sort((a, b) => a.text.localeCompare(b.text));
  }, [document, moveNodeId]);

  useEffect(() => {
    if (settingsOpen) {
      setWorkspace(workspaceName);
      setName(displayName);
    }
  }, [settingsOpen, workspaceName, displayName]);

  useEffect(() => {
    if (moveNodeId && moveTargets[0]) setMoveParentId(moveTargets[0].id);
    else setMoveParentId("");
  }, [moveNodeId, moveTargets]);

  return (
    <>
      <HelpCenter />
      <Modal
        open={shareOpen}
        onOpenChange={setShareOpen}
        title={shareFolder ? `Share ${shareFolder.name}` : "Share this map"}
        description={
          shareFolder
            ? "People with folder access can open every map inside it on this device."
            : "Roles apply to people on this device. There is no live link yet, so a file is still how you send the map."
        }
      >
        {shareFolder && folderShare?.role ? (
          <div className="space-y-4">
            <p className="text-sm">
              Your role on this folder is {documentRoleLabel(folderShare.role)}.{" "}
              {folderShare.canEdit ? "You can change maps inside it." : "You can look through maps inside it."}
            </p>
            <ul className="space-y-2">
              {members
                .filter((member) => member.workspaceRole === "owner")
                .map((member) => (
                  <li key={member.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{member.name}{member.id === activeMemberId ? " (you)" : ""}</span>
                    <span className="text-xs text-muted">Workspace owner</span>
                  </li>
                ))}
              {members
                .filter((member) => member.workspaceRole !== "owner" && folderGrants.some((grant) => grant.folderId === shareFolder.id && grant.memberId === member.id))
                .map((member) => {
                  const grant = folderGrants.find((item) => item.folderId === shareFolder.id && item.memberId === member.id);
                  return (
                    <li key={member.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{member.name}{member.id === activeMemberId ? " (you)" : ""}</span>
                      {folderShare.canManage ? (
                        <span className="flex items-center gap-2">
                          <select
                            aria-label={`Folder role for ${member.name}`}
                            className="h-8 rounded-lg border border-line bg-canvas px-2 text-sm"
                            value={grant?.role || "viewer"}
                            onChange={(event) => setFolderRole(shareFolder.id, member.id, event.target.value as DocumentRole)}
                          >
                            <option value="owner">Owner</option>
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <button type="button" className="text-xs text-danger" onClick={() => setFolderRole(shareFolder.id, member.id, "none")}>
                            Remove
                          </button>
                        </span>
                      ) : (
                        <span className="text-xs text-muted">{grant ? documentRoleLabel(grant.role) : "Viewer"}</span>
                      )}
                    </li>
                  );
                })}
            </ul>
            {folderShare.canManage ? (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!grantMemberId) return;
                  setFolderRole(shareFolder.id, grantMemberId, grantRole);
                  setGrantMemberId("");
                }}
              >
                <label className="min-w-36 flex-1 text-sm">
                  Person
                  <select
                    aria-label="Person to give folder access"
                    className="mt-1 h-9 w-full rounded-lg border border-line bg-canvas px-2"
                    value={grantMemberId}
                    onChange={(event) => setGrantMemberId(event.target.value)}
                  >
                    <option value="">Choose someone</option>
                    {members
                      .filter((member) => member.workspaceRole !== "owner" && !folderGrants.some((grant) => grant.folderId === shareFolder.id && grant.memberId === member.id))
                      .map((member) => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                  </select>
                </label>
                <label className="text-sm">
                  Role
                  <select
                    aria-label="Folder role"
                    className="mt-1 h-9 rounded-lg border border-line bg-canvas px-2"
                    value={grantRole}
                    onChange={(event) => setGrantRole(event.target.value as DocumentRole)}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="owner">Owner</option>
                  </select>
                </label>
                <button type="submit" className="h-9 rounded-lg bg-accent px-3 text-sm text-white">
                  Give access
                </button>
              </form>
            ) : null}
          </div>
        ) : document && access.role ? (
          <div className="space-y-4">
            <p className="text-sm">
              Your role on this map is {documentRoleLabel(access.role)}. {access.canEdit ? "You can change it." : "You can look through it."}
            </p>
            <ul className="space-y-2">
              {members
                .filter((member) => member.workspaceRole === "owner")
                .map((member) => (
                  <li key={member.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{member.name}{member.id === activeMemberId ? " (you)" : ""}</span>
                    <span className="text-xs text-muted">Workspace owner</span>
                  </li>
                ))}
              {members
                .filter((member) => member.workspaceRole !== "owner" && grants.some((grant) => grant.documentId === document.id && grant.memberId === member.id))
                .map((member) => {
                  const grant = grants.find((item) => item.documentId === document.id && item.memberId === member.id);
                  return (
                    <li key={member.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{member.name}{member.id === activeMemberId ? " (you)" : ""}</span>
                      {access.canManage ? (
                        <span className="flex items-center gap-2">
                          <select
                            aria-label={`Role for ${member.name}`}
                            className="h-8 rounded-lg border border-line bg-canvas px-2 text-sm"
                            value={grant?.role || "viewer"}
                            onChange={(event) => setDocumentRole(document.id, member.id, event.target.value as DocumentRole)}
                          >
                            <option value="owner">Owner</option>
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <button type="button" className="text-xs text-danger" onClick={() => setDocumentRole(document.id, member.id, "none")}>
                            Remove
                          </button>
                        </span>
                      ) : (
                        <span className="text-xs text-muted">{grant ? documentRoleLabel(grant.role) : "Viewer"}</span>
                      )}
                    </li>
                  );
                })}
            </ul>
            {access.canManage ? (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!grantMemberId) return;
                  setDocumentRole(document.id, grantMemberId, grantRole);
                  setGrantMemberId("");
                }}
              >
                <label className="min-w-36 flex-1 text-sm">
                  Person
                  <select
                    aria-label="Person to give access"
                    className="mt-1 h-9 w-full rounded-lg border border-line bg-canvas px-2"
                    value={grantMemberId}
                    onChange={(event) => setGrantMemberId(event.target.value)}
                  >
                    <option value="">Choose someone</option>
                    {members
                      .filter((member) => member.workspaceRole !== "owner" && !grants.some((grant) => grant.documentId === document.id && grant.memberId === member.id))
                      .map((member) => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                  </select>
                </label>
                <label className="text-sm">
                  Role
                  <select
                    aria-label="Document role"
                    className="mt-1 h-9 rounded-lg border border-line bg-canvas px-2"
                    value={grantRole}
                    onChange={(event) => setGrantRole(event.target.value as DocumentRole)}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="owner">Owner</option>
                  </select>
                </label>
                <button type="submit" className="h-9 rounded-lg bg-accent px-3 text-sm text-white">
                  Give access
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          {!shareFolder ? (
            <button
              type="button"
              className="h-9 rounded-lg border border-line px-3 text-sm"
              onClick={async () => {
                if (!document) return;
                try {
                  await navigator.clipboard.writeText(toOutline(document));
                  showBanner("Outline copied.");
                  setShareOpen(false);
                } catch {
                  showBanner("The browser blocked clipboard access.");
                }
              }}
            >
              Copy outline
            </button>
          ) : null}
          {!shareFolder ? (
            <button
              type="button"
              className="h-9 rounded-lg bg-accent px-3 text-sm text-white"
              onClick={() => {
                if (!document) return;
                downloadText(`${fileSlug(document.title)}.json`, JSON.stringify(document, null, 2), "application/json");
                setShareOpen(false);
              }}
            >
              Download JSON
            </button>
          ) : (
            <button type="button" className="h-9 rounded-lg bg-accent px-3 text-sm text-white" onClick={() => setShareOpen(false)}>
              Done
            </button>
          )}
        </div>
      </Modal>
      <Modal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="People on this device"
        description="Roles are stored in this browser. Anyone here can switch person. Sign-in is not built yet."
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            renameWorkspace(workspace, name);
            setSettingsOpen(false);
          }}
        >
          <label className="block text-sm">
            Your name
            <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-line bg-canvas px-3" />
          </label>
          <label className="block text-sm">
            Workspace
            <input
              value={workspace}
              disabled={!workspaceOwner}
              onChange={(event) => setWorkspace(event.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-line bg-canvas px-3 disabled:text-muted"
            />
          </label>
          <div className="flex justify-end">
            <button type="submit" className="h-9 rounded-lg bg-accent px-3 text-sm text-white">
              Save
            </button>
          </div>
        </form>
        <div className="mt-4 space-y-2 border-t border-line pt-4">
          <p className="text-sm font-medium">Workspace</p>
          <ul className="space-y-2">
            {members.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{member.name}{member.id === activeMemberId ? " (you)" : ""}</span>
                {workspaceOwner ? (
                  <span className="flex items-center gap-2">
                    <select
                      aria-label={`Workspace role for ${member.name}`}
                      className="h-8 rounded-lg border border-line bg-canvas px-2 text-sm"
                      value={member.workspaceRole}
                      onChange={(event) => setWorkspaceRole(member.id, event.target.value as WorkspaceRole)}
                    >
                      <option value="owner">Owner</option>
                      <option value="member">Member</option>
                    </select>
                    <button type="button" className="text-xs text-danger" onClick={() => removeMember(member.id)}>
                      Remove
                    </button>
                  </span>
                ) : (
                  <span className="text-xs text-muted">{workspaceRoleLabel(member.workspaceRole)}</span>
                )}
              </li>
            ))}
          </ul>
          {workspaceOwner ? (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addMember(person);
                setPerson("");
              }}
            >
              <input
                value={person}
                onChange={(event) => setPerson(event.target.value)}
                placeholder="Add a person"
                aria-label="New person"
                className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 text-sm"
              />
              <button type="submit" className="h-9 rounded-lg border border-line px-3 text-sm">
                Add
              </button>
            </form>
          ) : null}
        </div>
        <div className="mt-4 space-y-2 border-t border-line pt-4">
          <p className="text-sm font-medium">Use Arbour as</p>
          <div className="space-y-1">
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent-soft ${member.id === activeMemberId ? "bg-accent-soft" : ""}`}
                onClick={() => switchMember(member.id)}
              >
                {member.name}
                <span className="ml-2 text-xs text-muted">{workspaceRoleLabel(member.workspaceRole)}</span>
              </button>
            ))}
          </div>
        </div>
      </Modal>
      <Modal
        open={translateOpen}
        onOpenChange={setTranslateOpen}
        title="Translate map"
        description="Translate every topic label. Uses the browser translator when available, otherwise a free online service."
      >
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            From
            <select
              aria-label="Source language"
              className="h-9 rounded-lg border border-line bg-canvas px-2"
              value={sourceLang}
              onChange={(event) => setSourceLang(event.target.value as TranslateLanguage | "auto")}
            >
              <option value="auto">Detect / English</option>
              {TRANSLATE_LANGUAGES.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            To
            <select
              aria-label="Target language"
              className="h-9 rounded-lg border border-line bg-canvas px-2"
              value={targetLang}
              onChange={(event) => setTargetLang(event.target.value as TranslateLanguage)}
            >
              {TRANSLATE_LANGUAGES.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>
          {translateProgress ? <p className="text-xs text-muted">{translateProgress}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="h-8 rounded-lg px-3 text-sm" onClick={() => setTranslateOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="h-8 rounded-lg bg-accent px-3 text-sm text-white disabled:opacity-50"
              disabled={!document || translating || !access.canEdit}
              onClick={async () => {
                if (!document) return;
                setTranslating(true);
                setTranslateProgress("Translating…");
                try {
                  const nodes = Object.values(document.nodes);
                  const texts = nodes.map((node) => node.text);
                  const translated = await translateTexts(texts, targetLang, sourceLang, (done, total) => {
                    setTranslateProgress(`Translated ${done} of ${total} unique labels…`);
                  });
                  dispatch({
                    type: "renameMany",
                    updates: nodes.map((node, index) => ({ nodeId: node.id, text: translated[index] ?? node.text })),
                  });
                  showBanner(`Map translated to ${TRANSLATE_LANGUAGES.find((item) => item.id === targetLang)?.label ?? targetLang}.`);
                  setTranslateOpen(false);
                } catch {
                  showBanner("Translation failed. Check the network and try again.");
                } finally {
                  setTranslating(false);
                  setTranslateProgress("");
                }
              }}
            >
              {translating ? "Working…" : "Translate"}
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        open={Boolean(moveNodeId && moveNode)}
        onOpenChange={(open) => {
          if (!open) setMoveNodeId(null);
        }}
        title="Move under another topic"
        description={moveNode ? `Move “${moveNode.text}” (and its children) under a new parent.` : undefined}
      >
        <div className="space-y-3">
          <label className="flex flex-col gap-1 text-sm">
            New parent
            <select
              aria-label="New parent topic"
              className="h-9 rounded-lg border border-line bg-canvas px-2"
              value={moveParentId}
              onChange={(event) => setMoveParentId(event.target.value)}
            >
              {moveTargets.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.text || "Untitled"}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="h-8 rounded-lg px-3 text-sm" onClick={() => setMoveNodeId(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="h-8 rounded-lg bg-accent px-3 text-sm text-white disabled:opacity-50"
              disabled={!moveNodeId || !moveParentId || !access.canEdit}
              onClick={() => {
                if (!moveNodeId || !moveParentId || !document) return;
                dispatch({ type: "reparent", nodeId: moveNodeId, parentId: moveParentId });
                setMoveNodeId(null);
              }}
            >
              Move
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function Banner() {
  const banner = useEditor((state) => state.banner);
  const showBanner = useEditor((state) => state.showBanner);
  useEffect(() => {
    if (!banner) return;
    const timer = window.setTimeout(() => showBanner(""), 4200);
    return () => window.clearTimeout(timer);
  }, [banner, showBanner]);
  if (!banner) return null;
  return (
    <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-3 py-1.5 text-sm text-panel shadow-lg">
      {banner}
    </div>
  );
}
