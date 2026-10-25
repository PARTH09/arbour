import { describe, expect, it } from "vitest";

import {
  bootstrapAccess,
  canEditDocument,
  canManageDocument,
  effectiveDocumentRole,
  type AccessGrant,
  type AccessMember,
  type FolderGrant,
} from "./access";

const owner: AccessMember = { id: "owner", name: "You", workspaceRole: "owner" };
const editor: AccessMember = { id: "editor", name: "Avery", workspaceRole: "member" };
const viewer: AccessMember = { id: "viewer", name: "Blair", workspaceRole: "member" };

const grants: AccessGrant[] = [
  { documentId: "map", memberId: "editor", role: "editor" },
  { documentId: "map", memberId: "viewer", role: "viewer" },
];

const folderGrants: FolderGrant[] = [{ folderId: "ideas", memberId: "viewer", role: "viewer" }];

describe("document access", () => {
  it("gives workspace owners owner access to every map", () => {
    const role = effectiveDocumentRole(owner, [], "map");
    expect(role).toBe("owner");
    expect(canEditDocument(role)).toBe(true);
    expect(canManageDocument(role)).toBe(true);
  });

  it("lets editors change a map and keeps viewers from changing it", () => {
    const editorRole = effectiveDocumentRole(editor, grants, "map");
    const viewerRole = effectiveDocumentRole(viewer, grants, "map");
    expect(editorRole).toBe("editor");
    expect(canEditDocument(editorRole)).toBe(true);
    expect(canManageDocument(editorRole)).toBe(false);
    expect(viewerRole).toBe("viewer");
    expect(canEditDocument(viewerRole)).toBe(false);
    expect(canManageDocument(viewerRole)).toBe(false);
  });

  it("hides maps that were not shared with a member", () => {
    expect(effectiveDocumentRole(viewer, grants, "private")).toBeNull();
    expect(effectiveDocumentRole(undefined, grants, "map")).toBeNull();
  });

  it("opens maps through folder access when there is no direct grant", () => {
    const role = effectiveDocumentRole(viewer, [], "private", {
      folderId: "ideas",
      folderGrants,
    });
    expect(role).toBe("viewer");
    expect(canEditDocument(role)).toBe(false);
  });

  it("keeps a workspace owner when saved access has none", () => {
    const access = bootstrapAccess({
      members: [{ id: "avery", name: " Avery ", workspaceRole: "member" }],
      grants: [{ documentId: "map", memberId: "missing", role: "owner" }],
      displayName: "You",
      createId: () => "owner-id",
    });
    expect(access.members[0]).toEqual({ id: "owner-id", name: "You", workspaceRole: "owner" });
    expect(access.members[1].name).toBe("Avery");
    expect(access.grants).toEqual([]);
    expect(access.activeMemberId).toBe("owner-id");
  });
});
