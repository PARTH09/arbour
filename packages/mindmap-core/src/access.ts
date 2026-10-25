export const WORKSPACE_ROLES = ["owner", "member"] as const;
export const DOCUMENT_ROLES = ["owner", "editor", "viewer"] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];
export type DocumentRole = (typeof DOCUMENT_ROLES)[number];

export interface AccessMember {
  id: string;
  name: string;
  workspaceRole: WorkspaceRole;
}

export interface AccessGrant {
  documentId: string;
  memberId: string;
  role: DocumentRole;
}

export interface WorkspaceFolder {
  id: string;
  name: string;
}

export interface FolderGrant {
  folderId: string;
  memberId: string;
  role: DocumentRole;
}

export function documentRoleLabel(role: DocumentRole): string {
  if (role === "owner") return "Owner";
  if (role === "editor") return "Editor";
  return "Viewer";
}

export function workspaceRoleLabel(role: WorkspaceRole): string {
  return role === "owner" ? "Workspace owner" : "Member";
}

function roleRank(role: DocumentRole): number {
  if (role === "owner") return 3;
  if (role === "editor") return 2;
  return 1;
}

export function strongerRole(a: DocumentRole | null, b: DocumentRole | null): DocumentRole | null {
  if (!a) return b;
  if (!b) return a;
  return roleRank(a) >= roleRank(b) ? a : b;
}

export function effectiveFolderRole(
  member: AccessMember | undefined,
  folderGrants: FolderGrant[],
  folderId: string,
): DocumentRole | null {
  if (!member || !folderId) return null;
  if (member.workspaceRole === "owner") return "owner";
  return folderGrants.find((grant) => grant.folderId === folderId && grant.memberId === member.id)?.role ?? null;
}

export function effectiveDocumentRole(
  member: AccessMember | undefined,
  grants: AccessGrant[],
  documentId: string,
  options?: {
    folderId?: string | null;
    folderGrants?: FolderGrant[];
  },
): DocumentRole | null {
  if (!member || !documentId) return null;
  if (member.workspaceRole === "owner") return "owner";
  const direct = grants.find((grant) => grant.documentId === documentId && grant.memberId === member.id)?.role ?? null;
  const folderRole =
    options?.folderId && options.folderGrants
      ? effectiveFolderRole(member, options.folderGrants, options.folderId)
      : null;
  return strongerRole(direct, folderRole);
}

export function canEditDocument(role: DocumentRole | null): boolean {
  return role === "owner" || role === "editor";
}

export function canManageDocument(role: DocumentRole | null): boolean {
  return role === "owner";
}

export function bootstrapAccess(input: {
  members: AccessMember[];
  grants: AccessGrant[];
  folderGrants?: FolderGrant[];
  folders?: WorkspaceFolder[];
  activeMemberId?: string;
  displayName: string;
  createId: () => string;
}): {
  members: AccessMember[];
  grants: AccessGrant[];
  folderGrants: FolderGrant[];
  folders: WorkspaceFolder[];
  activeMemberId: string;
  displayName: string;
} {
  const seen = new Set<string>();
  let members = input.members.flatMap((member) => {
    const name = member.name.trim().slice(0, 40);
    if (!member.id || !name || seen.has(member.id)) return [];
    if (member.workspaceRole !== "owner" && member.workspaceRole !== "member") return [];
    seen.add(member.id);
    return [{ id: member.id, name, workspaceRole: member.workspaceRole }];
  });
  if (!members.some((member) => member.workspaceRole === "owner")) {
    const owner: AccessMember = {
      id: input.createId(),
      name: input.displayName.trim().slice(0, 40) || "You",
      workspaceRole: "owner",
    };
    members = [owner, ...members];
  }
  const memberIds = new Set(members.map((member) => member.id));
  const grants = input.grants.filter(
    (grant) =>
      memberIds.has(grant.memberId) &&
      (grant.role === "owner" || grant.role === "editor" || grant.role === "viewer") &&
      grant.documentId.length > 0,
  );
  const folders = (input.folders ?? []).flatMap((folder) => {
    const name = folder.name.trim().slice(0, 60);
    if (!folder.id || !name) return [];
    return [{ id: folder.id, name }];
  });
  const folderIds = new Set(folders.map((folder) => folder.id));
  const folderGrants = (input.folderGrants ?? []).filter(
    (grant) =>
      memberIds.has(grant.memberId) &&
      folderIds.has(grant.folderId) &&
      (grant.role === "owner" || grant.role === "editor" || grant.role === "viewer"),
  );
  const active = members.find((member) => member.id === input.activeMemberId) ?? members.find((member) => member.workspaceRole === "owner");
  return {
    members,
    grants,
    folders,
    folderGrants,
    activeMemberId: active?.id ?? members[0].id,
    displayName: active?.name ?? members[0].name,
  };
}
