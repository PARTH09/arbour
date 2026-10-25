import { describe, expect, it } from "vitest";

import { applyCommand, documentFromOutline } from "./commands";
import {
  childrenOf,
  createDocument,
  createGeneratedMap,
  documentIssues,
  findDropTarget,
  nearestInDirection,
  normalizeDocument,
} from "./document";
import { createHistory, historyCommit, historyRedo, historyUndo } from "./history";
import { visibleNodeBoxes } from "./layout";
import { parseOutline, toOutline } from "./outline";
import { parseDocument } from "./schema";
import { parseMapHref, sanitizeHref, sanitizeHttpUrl } from "./security";
import { BRANCH_COLORS, THEMES } from "./styles";
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
    expect(listTemplates()).toHaveLength(10);
    for (const template of listTemplates()) {
      const doc = createTemplateDocument(template.id, ctx());
      expect(doc?.title).toBe(template.title);
      expect(Object.keys(doc!.nodes).length).toBeGreaterThan(4);
      expect(documentIssues(doc!)).toEqual([]);
      expect(overlaps(doc!)).toBe(0);
    }
  });
});
