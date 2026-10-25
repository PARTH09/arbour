# Run Arbour locally

Arbour is a local mind-mapping editor. Maps, people, and roles are saved in this browser. There is no account server to start.

## What you need

- Node.js 22. The repository pins it in `.nvmrc`. Next.js 16 also accepts Node.js 20.9 or newer.
- npm 10, which ships with Node.js 22.

Check the version:

```bash
node -v
npm -v
```

If `node -v` is older than 20.9, install Node.js 22 and switch to it from the repository root:

```bash
nvm install
nvm use
```

`nvm use` reads `.nvmrc` and selects Node.js 22.

## Install and start

From the repository root:

```bash
nvm use
npm install
npm test
npm run dev
```

`npm install` installs the web app and the mind-map engine. `npm test` runs the engine tests. `npm run dev` starts the editor and prints a local URL. The default is:

http://localhost:3000

If that port is already in use, Next.js prints the port it chose. Open that URL.

The first page is the editor. Your maps are created in the browser and written to `localStorage` under the key `arbour.workspace.v1`.

## Other commands

Run these from the repository root.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the editor with hot reload |
| `npm test` | Run the mind-map engine tests |
| `npm run typecheck` | Typecheck the engine and the web app |
| `npm run lint` | Lint the web app |
| `npm run build` | Production build of the web app |
| `npm start` | Serve the production build. Run `npm run build` first. |

## Try roles and folders on this machine

The name at the bottom of the library opens people and roles.

1. Add a person. They start as a workspace member.
2. Open a map and choose **Share**, or create a folder with the folder button and share the folder.
3. Give that person **Viewer**, **Editor**, or **Owner** on the map or folder.
4. In the people dialog, choose **Use Arbour as** that person.

A viewer can look through the map and export it. An editor can change topics, layout, and undo. An owner of a map can also share it and move it to trash. Folder access applies to every map inside that folder. A workspace owner can see every map and add or remove people. The workspace keeps at least one owner.

On the canvas, two-finger trackpad movement pans the map. Hover a topic and use the **+** buttons for a child (right) or sibling (bottom). Keyboard flow matches common mind-map shortcuts: Tab child, Enter sibling, Mod+Enter sibling above, Alt+Enter parent, Mod+/ collapse, M for a detached topic, Mod+Shift+U for a link, Mod+Shift+V paste as outline, and Delete on a selected cross-link. Topic details can link to a website or another map on this device.

Anyone using this browser can switch person. Sign-in is not part of the local app.

## If the app does not start

- `Arbour needs Node.js 20.9 or newer` means the shell is on an older Node.js. Run `nvm use` in the repository root and start `npm run dev` again.
- A missing module usually means `npm install` was not run from the repository root. The root install covers `apps/web` and `packages/mindmap-core`.
- A blank editor after a refresh still has your maps in this browser. Clearing site data for the local URL removes them.
