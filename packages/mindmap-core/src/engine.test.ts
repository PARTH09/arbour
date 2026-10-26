import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { applyCommand, documentFromDocumentText, documentFromOutline } from "./commands";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");
const fixture = (name: string) => readFileSync(join(FIXTURES, name), "utf8");
import {
  childrenOf,
  connectorHandles,
  createDocument,
  createGeneratedMap,
  documentIssues,
  findDropTarget,
  nearestInDirection,
  normalizeDocument,
  refreshDocumentStyles,
} from "./document";
import { createHistory, historyCommit, historyRedo, historyUndo } from "./history";
import { visibleNodeBoxes } from "./layout";
import { parseOutline, toOutline } from "./outline";
import { parseDocument } from "./schema";
import { parseMapHref, sanitizeHref, sanitizeHttpUrl, sanitizeImageUrl } from "./security";
import { buildEdgePath } from "./edges";
import { BRANCH_COLORS, BRANCH_FILLS, THEMES } from "./styles";
import { toSvg } from "./svg";
import { createTemplateDocument, createWelcomeDocument, listTemplates } from "./templates";
import type { MindMapDocument } from "./types";

function ids() {
  let n = 0;
  return () => `n${++n}`;
}

function ctx() {
  return { createId: ids(), now: () => "2026-01-01T00:00:00.000Z" };
}

function map(): MindMapDocument {
  return createDocument({
    id: "doc",
    title: "Notes",
    rootText: "Root",
    createId: ids(),
    now: "2026-01-01T00:00:00.000Z",
  });
}

function run(doc: MindMapDocument, command: Parameters<typeof applyCommand>[1], context = ctx()) {
  return applyCommand(doc, command, context);
}

function overlaps(doc: MindMapDocument): number {
  const boxes = visibleNodeBoxes(doc);
  let count = 0;
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const separated =
        a.x + a.width <= b.x + 0.5 ||
        b.x + b.width <= a.x + 0.5 ||
        a.y + a.height <= b.y + 0.5 ||
        b.y + b.height <= a.y + 0.5;
      if (!separated) count += 1;
    }
  }
  return count;
}

describe("hierarchy", () => {
  it("adds children and siblings while keeping one tree edge each", () => {
    const context = ctx();
    let doc = map();
    const right = run(doc, { type: "addChild", parentId: doc.rootId, text: "Right", side: "right" }, context);
    doc = right.document;
    const child = run(doc, { type: "addChild", parentId: right.focusId!, text: "Detail" }, context);
    doc = child.document;
    const sibling = run(doc, { type: "addSibling", nodeId: right.focusId!, text: "Left" }, context);
    doc = sibling.document;

    expect(childrenOf(doc, doc.rootId).map((node) => node.text)).toEqual(["Right", "Left"]);
    expect(doc.nodes[child.focusId!].parentId).toBe(right.focusId);
    expect(doc.nodes[child.focusId!].style.borderColor).toBe(doc.nodes[right.focusId!].style.borderColor);
    expect(doc.nodes[right.focusId!].style.borderColor).toBe(BRANCH_COLORS[0]);
    expect(documentIssues(doc)).toEqual([]);
  });

  it("balances new main branches across both sides", () => {
    let doc = map();
    const context = ctx();
    const sides: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      const next = run(doc, { type: "addChild", parentId: doc.rootId, text: `Branch ${index}` }, context);
      doc = next.document;
      sides.push(doc.nodes[next.focusId!].side);
    }
    expect(sides).toEqual(["right", "left", "right", "left"]);
    const root = doc.nodes[doc.rootId];
    for (const child of childrenOf(doc, doc.rootId)) {
      if (child.side === "right") expect(child.position.x).toBeGreaterThan(root.position.x + root.width);
      else expect(child.position.x + child.width).toBeLessThan(root.position.x);
    }
    expect(overlaps(doc)).toBe(0);
  });

  it("gives new topics distinct, non-white branch colors", () => {
    let doc = map();
    const context = ctx();
    const created: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const next = run(doc, { type: "addChild", parentId: doc.rootId, text: `Branch ${index}` }, context);
      doc = next.document;
      created.push(next.focusId!);
    }

    expect(created.map((id) => doc.nodes[id].style.borderColor)).toEqual(BRANCH_COLORS.slice(0, 3));
    expect(created.map((id) => doc.nodes[id].style.background)).toEqual(BRANCH_FILLS.slice(0, 3));
    expect(created.every((id) => doc.nodes[id].style.background !== "#ffffff")).toBe(true);

    const leaf = run(doc, { type: "addChild", parentId: created[0], text: "Leaf" }, context);
    expect(leaf.document.nodes[leaf.focusId!].style.borderColor).toBe(BRANCH_COLORS[0]);
    expect(leaf.document.nodes[leaf.focusId!].style.shape).toBe("rounded");
    expect(leaf.document.nodes[leaf.focusId!].style.background).toBe(BRANCH_FILLS[0]);
    expect(leaf.document.nodes[leaf.focusId!].style.background).not.toBe("transparent");
  });

  it("promotes a legacy underline leaf to a boxed parent when it gains a child", () => {
    const context = ctx();
    let doc = map();
    const branch = run(doc, { type: "addChild", parentId: doc.rootId, text: "Branch" }, context);
    doc = branch.document;
    const leaf = run(doc, { type: "addChild", parentId: branch.focusId!, text: "Leaf" }, context);
    doc = leaf.document;
    doc = {
      ...doc,
      nodes: {
        ...doc.nodes,
        [leaf.focusId!]: {
          ...doc.nodes[leaf.focusId!],
          style: {
            ...doc.nodes[leaf.focusId!].style,
            shape: "underline",
            background: "transparent",
            shadow: "none",
          },
        },
      },
    };

    const nested = run(doc, { type: "addChild", parentId: leaf.focusId!, text: "Nested" }, context);
    expect(nested.document.nodes[leaf.focusId!].style.shape).toBe("rounded");
    expect(nested.document.nodes[leaf.focusId!].style.background).not.toBe("transparent");
    expect(nested.document.nodes[nested.focusId!].style.shape).toBe("rounded");
  });

  it("inherits branch color and rounded fill when reparenting", () => {
    const context = ctx();
    let doc = map();
    const a = run(doc, { type: "addChild", parentId: doc.rootId, text: "A" }, context);
    doc = a.document;
    const b = run(doc, { type: "addChild", parentId: doc.rootId, text: "B" }, context);
    doc = b.document;
    const leaf = run(doc, { type: "addChild", parentId: a.focusId!, text: "Leaf" }, context);
    doc = leaf.document;
    expect(doc.nodes[leaf.focusId!].style.borderColor).toBe(BRANCH_COLORS[0]);

    const moved = run(
      doc,
      { type: "reparent", nodeId: leaf.focusId!, parentId: b.focusId! },
      context,
    );
    expect(moved.document.nodes[leaf.focusId!].style.borderColor).toBe(BRANCH_COLORS[1]);
    expect(moved.document.nodes[leaf.focusId!].style.shape).toBe("rounded");
    expect(moved.document.nodes[leaf.focusId!].style.background).toBe(BRANCH_FILLS[1]);
  });

  it("repairs white topic fills from older documents", () => {
    const context = ctx();
    let doc = map();
    const branch = run(doc, { type: "addChild", parentId: doc.rootId, text: "Branch" }, context);
    doc = branch.document;
    doc = {
      ...doc,
      nodes: {
        ...doc.nodes,
        [branch.focusId!]: {
          ...doc.nodes[branch.focusId!],
          style: { ...doc.nodes[branch.focusId!].style, background: "#ffffff" },
        },
      },
    };
    const repaired = refreshDocumentStyles(doc);
    expect(repaired.nodes[branch.focusId!].style.background).toBe(BRANCH_FILLS[0]);
    expect(repaired.nodes[branch.focusId!].style.background).not.toBe("#ffffff");
  });

  it("can keep dense-map connectors on the right-side center handles", () => {
    const source = { ...map().nodes.n1, position: { x: 220, y: 140 } };
    const target = { ...map().nodes.n1, position: { x: 40, y: 80 } };

    expect(connectorHandles(source, target, { preferRight: true })).toEqual({
      sourceHandle: "source-right",
      targetHandle: "target-left",
    });
  });

  it("attaches balanced left and right branches on the inner sides", () => {
    const root = map().nodes.n1;
    const leftChild = { ...root, id: "left", side: "left" as const, position: { x: 40, y: 80 }, floating: false };
    const rightChild = { ...root, id: "right", side: "right" as const, position: { x: 280, y: 80 }, floating: false };

    expect(connectorHandles(root, leftChild, { layout: "balanced" })).toEqual({
      sourceHandle: "source-left",
      targetHandle: "target-right",
    });
    expect(connectorHandles(root, rightChild, { layout: "balanced" })).toEqual({
      sourceHandle: "source-right",
      targetHandle: "target-left",
    });
  });

  it("keeps orthogonal forks from overshooting the child", () => {
    const path = buildEdgePath("orthogonal", 200, 100, 160, 140);
    // Stub must stay between parent (200) and child (160) — no reverse stub past 160.
    expect(path).toMatch(/^M 200 100 L (\d+(?:\.\d+)?) 100 L \1 140 L 160 140$/);
    const railX = Number(path.match(/^M 200 100 L (\d+)/)?.[1]);
    expect(railX).toBeLessThan(200);
    expect(railX).toBeGreaterThan(160);

    const vertical = buildEdgePath("orthogonal", 100, 200, 120, 120);
    expect(vertical).toMatch(/^M 100 200 L 100 (\d+(?:\.\d+)?) L 120 \1 L 120 120$/);
    const railY = Number(vertical.match(/^M 100 200 L 100 (\d+)/)?.[1]);
    expect(railY).toBeLessThan(200);
    expect(railY).toBeGreaterThan(120);
  });

  it("deletes a subtree and refuses to delete the root", () => {
    const context = ctx();
    let doc = map();
    const parent = run(doc, { type: "addChild", parentId: doc.rootId, text: "Parent" }, context);
    doc = parent.document;
    const child = run(doc, { type: "addChild", parentId: parent.focusId!, text: "Child" }, context);
    doc = child.document;
    const removed = run(doc, { type: "deleteNodes", ids: [parent.focusId!] }, context);
    expect(removed.document.nodes[parent.focusId!]).toBeUndefined();
    expect(removed.document.nodes[child.focusId!]).toBeUndefined();
    expect(Object.values(removed.document.edges)).toHaveLength(0);
    expect(documentIssues(removed.document)).toEqual([]);

    const blocked = run(doc, { type: "deleteNodes", ids: [doc.rootId] }, context);
    expect(blocked.changed).toBe(false);
    expect(blocked.document.nodes[doc.rootId]).toBeTruthy();
  });

  it("blocks circular reparenting and promotes a topic one level", () => {
    const context = ctx();
    let doc = map();
    const parent = run(doc, { type: "addChild", parentId: doc.rootId, text: "Parent" }, context);
    doc = parent.document;
    const child = run(doc, { type: "addChild", parentId: parent.focusId!, text: "Child" }, context);
    doc = child.document;
    const grand = run(doc, { type: "addChild", parentId: child.focusId!, text: "Grand" }, context);
    doc = grand.document;

    const cycle = run(
      doc,
      { type: "reparent", nodeId: parent.focusId!, parentId: grand.focusId! },
      context,
    );
    expect(cycle.changed).toBe(false);
    expect(cycle.document.nodes[parent.focusId!].parentId).toBe(doc.rootId);

    const promoted = run(doc, { type: "promote", nodeId: grand.focusId! }, context);
    expect(promoted.document.nodes[grand.focusId!].parentId).toBe(parent.focusId);
    expect(documentIssues(promoted.document)).toEqual([]);
  });

  it("inserts a sibling above and a parent between a topic and its parent", () => {
    const context = ctx();
    let doc = map();
    const first = run(doc, { type: "addChild", parentId: doc.rootId, text: "First" }, context);
    doc = first.document;
    const second = run(doc, { type: "addSibling", nodeId: first.focusId!, text: "Second" }, context);
    doc = second.document;

    const above = run(
      doc,
      { type: "addSibling", nodeId: second.focusId!, text: "Above", placement: "above" },
      context,
    );
    doc = above.document;
    expect(childrenOf(doc, doc.rootId).map((node) => node.text)).toEqual(["First", "Above", "Second"]);

    const wrapped = run(doc, { type: "addParent", nodeId: second.focusId!, text: "Parent" }, context);
    doc = wrapped.document;
    const parentNode = doc.nodes[wrapped.focusId!];
    expect(parentNode.text).toBe("Parent");
    expect(parentNode.parentId).toBe(doc.rootId);
    expect(doc.nodes[second.focusId!].parentId).toBe(wrapped.focusId);
    expect(childrenOf(doc, doc.rootId).map((node) => node.text)).toEqual(["First", "Above", "Parent"]);
    expect(documentIssues(doc)).toEqual([]);

    const blocked = run(doc, { type: "addParent", nodeId: doc.rootId }, context);
    expect(blocked.changed).toBe(false);
  });

  it("deletes cross-links but keeps tree connectors", () => {
    const context = ctx();
    let doc = map();
    const left = run(doc, { type: "addChild", parentId: doc.rootId, text: "Left", side: "left" }, context);
    doc = left.document;
    const right = run(doc, { type: "addChild", parentId: doc.rootId, text: "Right", side: "right" }, context);
    doc = right.document;
    const linked = run(
      doc,
      { type: "addLink", sourceId: left.focusId!, targetId: right.focusId! },
      context,
    );
    doc = linked.document;
    const linkId = Object.values(doc.edges).find((edge) => edge.kind === "link")?.id;
    expect(linkId).toBeTruthy();
    const treeIds = Object.values(doc.edges).filter((edge) => edge.kind === "tree").map((edge) => edge.id);

    const removed = run(doc, { type: "deleteEdges", ids: [linkId!, ...treeIds] }, context);
    expect(removed.changed).toBe(true);
    expect(Object.values(removed.document.edges).some((edge) => edge.kind === "link")).toBe(false);
    expect(Object.values(removed.document.edges).filter((edge) => edge.kind === "tree").length).toBe(
      treeIds.length,
    );
  });

  it("duplicates a subtree with new ids", () => {
    const context = ctx();
    let doc = map();
    const parent = run(doc, { type: "addChild", parentId: doc.rootId, text: "Parent", side: "right" }, context);
    doc = parent.document;
    doc = run(doc, { type: "addChild", parentId: parent.focusId!, text: "Child" }, context).document;
    const before = Object.keys(doc.nodes).length;
    const copy = run(doc, { type: "duplicate", nodeId: parent.focusId! }, context);
    expect(Object.keys(copy.document.nodes)).toHaveLength(before + 2);
    const siblings = childrenOf(copy.document, copy.document.rootId);
    expect(siblings.filter((node) => node.text === "Parent")).toHaveLength(2);
    expect(siblings.every((node) => node.side === "right")).toBe(true);
    expect(documentIssues(copy.document)).toEqual([]);
  });

  it("turns an indented outline into a hierarchy and round-trips it", () => {
    const doc = documentFromOutline(
      ["Launch", "  Audience", "    New readers", "  Channel", "    Newsletter"].join("\n"),
      "Launch",
      ctx(),
    );
    expect(doc).toBeTruthy();
    const rootChildren = childrenOf(doc!, doc!.rootId).map((node) => node.text);
    expect(rootChildren).toEqual(["Audience", "Channel"]);
    expect(childrenOf(doc!, childrenOf(doc!, doc!.rootId)[0].id)[0].text).toBe("New readers");
    const parsed = parseOutline(toOutline(doc!));
    expect(parsed.map((line) => line.text)).toEqual([
      "Launch",
      "Audience",
      "New readers",
      "Channel",
      "Newsletter",
    ]);
  });

  it("imports Whimsical-style Markdown headings, bullets, and paste-special outlines", () => {
    const fromHeadings = documentFromOutline(
      [
        "# Product Ideas",
        "## Personal",
        "- Automated **Task** Creation",
        "- [Workflow Rules](https://example.com)",
        "## Data",
        "1. Analytics",
        "2. Sync",
      ].join("\n"),
      undefined,
      ctx(),
    );
    expect(fromHeadings?.title).toBe("Product Ideas");
    expect(fromHeadings?.nodes[fromHeadings.rootId].text).toBe("Product Ideas");
    const branches = childrenOf(fromHeadings!, fromHeadings!.rootId).map((node) => node.text);
    expect(branches).toEqual(["Personal", "Data"]);
    expect(childrenOf(fromHeadings!, childrenOf(fromHeadings!, fromHeadings!.rootId)[0].id).map((n) => n.text)).toEqual([
      "Automated Task Creation",
      "Workflow Rules",
    ]);
    expect(childrenOf(fromHeadings!, childrenOf(fromHeadings!, fromHeadings!.rootId)[1].id).map((n) => n.text)).toEqual([
      "Analytics",
      "Sync",
    ]);

    const fromBullets = documentFromOutline(
      ["- Launch", "  - Audience", "    - New readers", "  - Channel"].join("\n"),
      "from-whimsical",
      ctx(),
    );
    expect(fromBullets?.title).toBe("from-whimsical");
    expect(childrenOf(fromBullets!, fromBullets!.rootId).map((n) => n.text)).toEqual(["Audience", "Channel"]);

    const pasteSpecial = parseOutline(["Ideas", "\tPersonal", "\t\tTask", "\tData"].join("\n"));
    expect(pasteSpecial.map((line) => ({ depth: line.depth, text: line.text }))).toEqual([
      { depth: 0, text: "Ideas" },
      { depth: 1, text: "Personal" },
      { depth: 2, text: "Task" },
      { depth: 1, text: "Data" },
    ]);
  });

  it("builds a hierarchy from prose-style document text", () => {
    const doc = documentFromDocumentText(fixture("document-product-plan.txt"), "from-pdf", ctx());
    expect(doc?.title).toBe("from-pdf");
    expect(doc?.nodes[doc.rootId].text).toBe("Product Plan");
    const branches = childrenOf(doc!, doc!.rootId).map((node) => node.text);
    expect(branches[0]).toMatch(/Audience/);
    expect(branches.some((text) => /Timeline/.test(text))).toBe(true);
    expect(branches.some((text) => /Risks/.test(text))).toBe(true);
  });

  it("loads Whimsical, Hindi, and Gujarati fixture outlines", () => {
    const whimsical = documentFromOutline(fixture("whimsical-product-ideas.md"), undefined, ctx());
    expect(whimsical?.nodes[whimsical.rootId].text).toBe("Product Ideas");
    expect(childrenOf(whimsical!, whimsical!.rootId).map((node) => node.text)).toEqual([
      "Personal productivity",
      "Data & sync",
      "Growth",
    ]);

    const hindi = documentFromOutline(fixture("document-hindi-outline.md"), "hindi-sample", ctx());
    expect(hindi?.title).toBe("hindi-sample");
    expect(hindi?.nodes[hindi.rootId].text).toBe("उत्पाद योजना");
    expect(childrenOf(hindi!, hindi!.rootId).map((node) => node.text)).toEqual([
      "दर्शक",
      "समयरेखा",
      "जोखिम",
    ]);

    const gujarati = documentFromOutline(fixture("document-gujarati-outline.md"), "gujarati-sample", ctx());
    expect(gujarati?.nodes[gujarati.rootId].text).toBe("ઉત્પાદન યોજના");
    expect(childrenOf(gujarati!, gujarati!.rootId).map((node) => node.text)).toEqual([
      "પ્રેક્ષકો",
      "સમયરેખા",
      "જોખમો",
    ]);
  });

  it("collapses many branches and renames many topics at once", () => {
    const context = ctx();
    let doc = map();
    const parent = run(doc, { type: "addChild", parentId: doc.rootId, text: "Parent" }, context);
    doc = parent.document;
    const child = run(doc, { type: "addChild", parentId: parent.focusId!, text: "Child" }, context);
    doc = child.document;
    const collapsed = run(
      doc,
      { type: "setCollapsed", ids: [parent.focusId!], collapsed: true },
      context,
    );
    expect(collapsed.document.nodes[parent.focusId!].collapsed).toBe(true);
    const renamed = run(
      collapsed.document,
      {
        type: "renameMany",
        updates: [
          { nodeId: parent.focusId!, text: "माता" },
          { nodeId: child.focusId!, text: "बच्चा" },
        ],
      },
      context,
    );
    expect(renamed.document.nodes[parent.focusId!].text).toBe("माता");
    expect(renamed.document.nodes[child.focusId!].text).toBe("बच्चा");
  });

  it("rejects a circular import and unsafe urls", () => {
    let doc = map();
    const context = ctx();
    const parent = run(doc, { type: "addChild", parentId: doc.rootId, text: "Parent" }, context);
    doc = parent.document;
    const child = run(doc, { type: "addChild", parentId: parent.focusId!, text: "Child" }, context);
    doc = child.document;
    const corrupt = structuredClone(doc);
    corrupt.nodes[parent.focusId!].parentId = child.focusId!;
    corrupt.nodes[child.focusId!].parentId = parent.focusId!;
    expect(normalizeDocument(corrupt).ok).toBe(false);

    expect(sanitizeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeHttpUrl("https://user:pass@example.com/a.png")).toBeNull();
    expect(sanitizeHttpUrl("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(sanitizeImageUrl("data:image/png;base64,abc=")).toBe("data:image/png;base64,abc=");
    expect(sanitizeImageUrl("data:text/html;base64,abc=")).toBeNull();
    expect(sanitizeHref("arbour:map:11111111-1111-4111-8111-111111111111")).toBe(
      "arbour:map:11111111-1111-4111-8111-111111111111",
    );
    expect(parseMapHref("arbour:map:11111111-1111-4111-8111-111111111111")).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(sanitizeHref("javascript:alert(1)")).toBeNull();
    const patched = run(
      doc,
      { type: "patchNodes", ids: [parent.focusId!], href: "javascript:alert(1)" },
      context,
    );
    expect(patched.document.nodes[parent.focusId!].href).toBeNull();
  });
});

describe("layout", () => {
  it("keeps the root anchored and avoids overlap in each orthogonal layout", () => {
    let doc = createWelcomeDocument(ctx());
    const root = { ...doc.nodes[doc.rootId].position };
    for (const orientation of ["balanced", "right", "left", "down", "up"] as const) {
      const next = run(doc, { type: "setLayout", layout: { orientation } }, ctx());
      doc = next.document;
      expect(doc.nodes[doc.rootId].position).toEqual(root);
      expect(overlaps(doc)).toBe(0);
      expect(documentIssues(doc)).toEqual([]);
      if (orientation === "down") {
        const child = childrenOf(doc, doc.rootId)[0];
        expect(child.position.y).toBeGreaterThan(doc.nodes[doc.rootId].position.y);
      }
      if (orientation === "up") {
        const child = childrenOf(doc, doc.rootId)[0];
        expect(child.position.y + child.height).toBeLessThan(doc.nodes[doc.rootId].position.y);
      }
    }
  });

  it("places a radial map around the root", () => {
    const doc = run(createWelcomeDocument(ctx()), { type: "setLayout", layout: { orientation: "radial" } }, ctx())
      .document;
    const root = doc.nodes[doc.rootId];
    const center = {
      x: root.position.x + root.width / 2,
      y: root.position.y + root.height / 2,
    };
    for (const child of childrenOf(doc, doc.rootId)) {
      const dx = child.position.x + child.width / 2 - center.x;
      const dy = child.position.y + child.height / 2 - center.y;
      expect(Math.hypot(dx, dy)).toBeGreaterThan(80);
    }
  });

  it("lays out 100, 1,000, and 5,000 topics", () => {
    const samples = [
      { branching: 3, depth: 4, limit: 250, cap: 200 },
      { branching: 3, depth: 6, limit: 800, cap: 1200 },
      { branching: 4, depth: 12, limit: 2000, cap: 5000 },
    ];
    const timings: string[] = [];
    for (const sample of samples) {
      const started = performance.now();
      const doc = createGeneratedMap(sample.branching, sample.depth, sample.cap);
      const elapsed = performance.now() - started;
      const count = Object.keys(doc.nodes).length;
      timings.push(`${count} topics in ${elapsed.toFixed(1)}ms`);
      expect(count).toBeGreaterThan(80);
      expect(count).toBeLessThanOrEqual(5000);
      expect(elapsed).toBeLessThan(sample.limit);
      expect(documentIssues(doc)).toEqual([]);
      expect(Object.values(doc.nodes).every((node) => Number.isFinite(node.position.x))).toBe(true);
      if (count <= 1200) expect(overlaps(doc)).toBe(0);
    }
    console.info(`Layout timings: ${timings.join("; ")}`);
  });
});

describe("history, navigation, and themes", () => {
  it("restores a deleted subtree with undo and redo", () => {
    const context = ctx();
    let doc = map();
    const parent = run(doc, { type: "addChild", parentId: doc.rootId, text: "Parent" }, context);
    doc = parent.document;
    const child = run(doc, { type: "addChild", parentId: parent.focusId!, text: "Child" }, context);
    doc = child.document;
    let history = createHistory(doc);
    const removed = run(history.present, { type: "deleteNodes", ids: [parent.focusId!] }, context);
    history = historyCommit(history, removed.document);
    history = historyUndo(history);
    expect(history.present.nodes[child.focusId!].text).toBe("Child");
    expect(history.present.nodes[child.focusId!].parentId).toBe(parent.focusId);
    history = historyRedo(history);
    expect(history.present.nodes[parent.focusId!]).toBeUndefined();
  });

  it("coalesces a typing session into one undo step", () => {
    let doc = map();
    let history = createHistory(doc);
    const first = run(history.present, { type: "rename", nodeId: doc.rootId, text: "A" }, ctx());
    history = historyCommit(history, first.document);
    const second = run(history.present, { type: "rename", nodeId: doc.rootId, text: "AB" }, ctx());
    history = historyCommit(history, second.document, true);
    expect(history.past).toHaveLength(1);
    history = historyUndo(history);
    expect(history.present.nodes[doc.rootId].text).toBe("Root");
  });

  it("navigates by direction and finds a drop target", () => {
    const doc = createWelcomeDocument(ctx());
    const first = childrenOf(doc, doc.rootId).find((node) => node.side === "right");
    expect(first).toBeTruthy();
    const next = nearestInDirection(doc, first!.id, "left");
    expect(next).toBeTruthy();
    const target = doc.nodes[next!];
    const hit = findDropTarget(doc, first!.id, {
      x: target.position.x + target.width / 2,
      y: target.position.y + target.height / 2,
    });
    expect(hit).toBe(target.id);
    expect(findDropTarget(doc, doc.rootId, { x: -9999, y: -9999 })).toBeNull();
  });

  it("lets a theme skip topics that were formatted by hand", () => {
    const context = ctx();
    let doc = map();
    const branch = run(doc, { type: "addChild", parentId: doc.rootId, text: "Branch" }, context);
    doc = branch.document;
    const locked = run(
      doc,
      { type: "patchNodes", ids: [branch.focusId!], style: { background: "#fff1f2" } },
      context,
    );
    doc = locked.document;
    expect(doc.nodes[branch.focusId!].style.themeLock).toBe(true);
    const themed = run(doc, { type: "applyTheme", themeId: "ink" }, context).document;
    expect(themed.nodes[branch.focusId!].style.background).toBe("#fff1f2");
    expect(themed.nodes[doc.rootId].style.background).toBe(
      THEMES.find((theme) => theme.id === "ink")?.root.background,
    );
  });

  it("exports escaped svg and parses its own schema", () => {
    let doc = map();
    doc = run(doc, { type: "rename", nodeId: doc.rootId, text: "<script>" }, ctx()).document;
    const svg = toSvg(doc);
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).not.toContain("<script>");
    const parsed = parseDocument(doc);
    expect(parsed.ok).toBe(true);
    expect(parseDocument({ hello: "no" }).ok).toBe(false);
  });

  it("builds every starter template into a valid map", () => {
    expect(listTemplates()).toHaveLength(11);
    for (const template of listTemplates()) {
      const doc = createTemplateDocument(template.id, ctx());
      expect(doc?.title).toBe(template.title);
      expect(Object.keys(doc!.nodes).length).toBeGreaterThan(4);
      expect(documentIssues(doc!)).toEqual([]);
      expect(overlaps(doc!)).toBe(0);
    }
  });
});
