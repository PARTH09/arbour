# Database

Phase 1 stores maps in the browser. This is the Postgres schema to add in Phase 3. It is not migrated, and there is no API yet.

The database is the source of truth for identity, permissions, and document bytes. Binary exports and images go to object storage. Redis is for rate limits, pub/sub fanout, and short-lived presence, not for the document itself.

## Identity

```sql
create table users (
  id uuid primary key,
  email text not null unique,
  password_hash text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table user_sessions (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table user_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  theme text not null default 'light',
  preferences jsonb not null default '{}'::jsonb
);
```

## Workspaces

```sql
create table workspaces (
  id uuid primary key,
  name text not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  primary key (workspace_id, user_id)
);

create table workspace_folders (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  parent_id uuid references workspace_folders(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
```

## Documents

`document_state` holds the same JSON the editor already validates with Zod, including `schema_version`. Normalized node and edge rows are added when a document is large enough that rewriting the whole JSON on every edit is wasteful. Until then, one snapshot per save is enough and matches the client model.

```sql
create table documents (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  folder_id uuid references workspace_folders(id) on delete set null,
  title text not null,
  document_type text not null default 'mindmap',
  schema_version integer not null,
  document_state jsonb not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz
);

create index documents_workspace_updated_idx
  on documents (workspace_id, updated_at desc)
  where deleted_at is null;

create table document_permissions (
  document_id uuid not null references documents(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  email text,
  role text not null check (role in ('viewer', 'editor', 'owner')),
  created_at timestamptz not null default now(),
  check (user_id is not null or email is not null)
);

create table document_snapshots (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  schema_version integer not null,
  document_state jsonb not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  label text
);

create table document_operations (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  actor_id uuid references users(id),
  base_version bigint not null,
  operation jsonb not null,
  created_at timestamptz not null default now(),
  unique (document_id, base_version, id)
);

create table document_assets (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  storage_key text not null,
  content_type text not null,
  byte_size integer not null,
  created_at timestamptz not null default now()
);
```

Node and edge tables, used when a document moves off a single JSON blob:

```sql
create table mindmap_nodes (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  parent_id uuid,
  node_type text not null,
  text text not null,
  position jsonb not null,
  style jsonb not null,
  sort_order integer not null,
  collapsed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mindmap_nodes_document_parent_idx
  on mindmap_nodes (document_id, parent_id, sort_order);

create table mindmap_edges (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  source_node_id uuid not null,
  target_node_id uuid not null,
  edge_type text not null,
  style jsonb not null,
  label text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mindmap_edges_document_idx on mindmap_edges (document_id);
```

`parent_id` is a logical parent inside the same document. The application checks cycles in a transaction. A database foreign key cannot express "parent belongs to this document" without a composite key, so the write path must check that both rows share `document_id`.

## Collaboration and deletion

```sql
create table comments (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  node_id uuid,
  author_id uuid not null references users(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table comment_mentions (
  comment_id uuid not null references comments(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (comment_id, user_id)
);

create table document_activity (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  actor_id uuid references users(id),
  action text not null,
  created_at timestamptz not null default now()
);
```

Deletion:

- Trashing a document sets `deleted_at`. Nodes, edges, and snapshots stay so it can be restored.
- Permanent delete removes the document row and, through `on delete cascade`, its permissions, snapshots, operations, comments, and asset rows. Object-storage keys are deleted by a job, not by the request that returns to the user.
- Snapshot retention keeps the latest 50 snapshots and anything the user labeled. Restoring a snapshot writes a new operation. It does not silently replace a newer operation from someone else.
- Account deletion removes sessions immediately, anonymizes activity, and deletes documents only in workspaces that user alone owns.

Every protected query filters by workspace membership or a document permission. Public links are a row in `document_permissions` with a revocable token hash, not an unguessable document id alone.

## API

Routes will live under `/api/v1` and follow the command list in the product brief: auth, workspaces, documents, nodes, edges, layout, history, sharing, and import/export. They are not implemented. The request body for a structural edit should be the same command the editor already runs, rejected if it fails validation or the caller's role is viewer.
