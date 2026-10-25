# Arbour

Arbour is a mind-mapping workspace. Phase 1 is a local editor: an infinite canvas, a real topic hierarchy, automatic layouts, keyboard editing, undo, and browser persistence.

Accounts, a server, and live collaboration are designed and not built yet.

## Requirements

- Node.js 20.9 or newer. Node.js 22 is pinned in `.nvmrc`.
- npm 10

```bash
nvm use
npm install
npm test
npm run dev
```

Open the URL printed by the dev server. The default is http://localhost:3000.

The full local setup, including roles on this machine, is in [docs/local-setup.md](docs/local-setup.md).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the editor |
| `npm test` | Run the mind-map engine tests |
| `npm run typecheck` | Typecheck the engine and the web app |
| `npm run build` | Production build of the web app |

## What works now

- Create, rename, favorite, duplicate, trash, restore, and permanently delete maps on this device.
- Ten templates that create editable maps.
- Add children and siblings, promote, reparent by dragging, reorder siblings, duplicate with Option-drag, detach from the context menu, and delete subtrees.
- Paste an indented outline into the selected topic.
- Balanced, left, right, top-down, bottom-up, and radial layouts, plus compact, comfortable, and expanded spacing.
- Independent topic shapes, colors, type, notes, links, tags, and emoji.
- Curved, straight, and elbow connectors, including cross-links that are not part of the tree.
- Undo and redo, including one undo step for a typing session.
- Keyboard shortcuts. Press `?` in the editor.
- Export JSON, a plain-text outline, SVG, and PNG.
- Import an Arbour JSON file or an indented outline.
- Save state is local: Saving, Saved locally, Saved on this device while offline, or Not saved. The editor does not say Saved before the browser write finishes.
- Roles on this device. A workspace owner manages people. Each map can be shared as owner, editor, or viewer. Viewers can look and export. Editors can change the map. Owners can also share it and move it to trash. Sign-in and a server are not built, so anyone using this browser can switch person.

## Measured layout

The layout engine was timed in unit tests on this machine:

| Topics | Layout time |
| --- | --- |
| 121 | 1.1 ms |
| 1,093 | 8.6 ms |
| 5,000 | 40.2 ms |

These numbers are for placement math, not for drawing the map in the browser. React Flow renders topics as DOM nodes. A 5,000-topic map has not been accepted as smooth in the editor, and that is the point where a canvas renderer should be measured before claiming the budget.

## What is not built yet

- Accounts, workspaces on a server, and sign-in. Roles in the editor stay on this device.
- Postgres, Redis, and file storage
- Snapshot history that can be restored without overwriting collaborators
- Live cursors, comments, and CRDT collaboration
- PDF export and file uploads
- AI generation

See `docs/architecture.md` for the decisions behind the current shape, and `docs/database.md` for the schema planned for Phase 3.
