import { z } from "zod";

import { normalizeDocument } from "./document";
import type { MindMapDocument } from "./types";

const pointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

const nodeStyleSchema = z.object({
  shape: z.enum(["rounded", "rectangle", "pill", "ellipse", "underline", "borderless"]),
  background: z.string().min(1).max(40),
  color: z.string().min(1).max(40),
  borderColor: z.string().min(1).max(40),
  borderWidth: z.number().min(0).max(8),
  borderStyle: z.enum(["solid", "dashed", "dotted", "none"]),
  opacity: z.number().min(0.15).max(1),
  fontFamily: z.enum(["sans", "serif", "mono"]),
  fontSize: z.number().min(10).max(48),
  fontWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]),
  fontStyle: z.enum(["normal", "italic"]),
  textDecoration: z.enum(["none", "underline"]),
  textAlign: z.enum(["left", "center", "right"]),
  shadow: z.enum(["none", "soft"]),
  themeLock: z.boolean(),
});

const edgeStyleSchema = z.object({
  path: z.enum(["bezier", "straight", "orthogonal"]),
  stroke: z.string().min(1).max(40),
  strokeWidth: z.number().min(0.5).max(8),
  lineStyle: z.enum(["solid", "dashed", "dotted"]),
  marker: z.enum(["none", "arrow"]),
  followNode: z.boolean(),
});

const nodeSchema = z.object({
  id: z.string().min(1).max(80),
  parentId: z.string().min(1).max(80).nullable(),
  text: z.string().max(2000),
  nodeType: z.enum(["topic", "note", "text", "image"]),
  side: z.enum(["left", "right"]),
  sortOrder: z.number().int(),
  collapsed: z.boolean(),
  floating: z.boolean(),
  position: pointSchema,
  width: z.number().positive().max(2000),
  height: z.number().positive().max(2000),
  style: nodeStyleSchema,
  note: z.string().max(500),
  href: z.string().max(2000).nullable(),
  tags: z.array(z.string().max(24)).max(8),
  emoji: z.string().max(16),
  imageUrl: z.string().max(1_000_000).nullable(),
});

const edgeSchema = z.object({
  id: z.string().min(1).max(80),
  sourceId: z.string().min(1).max(80),
  targetId: z.string().min(1).max(80),
  kind: z.enum(["tree", "link"]),
  label: z.string().max(80),
  style: edgeStyleSchema,
});

export const documentSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  schemaVersion: z.literal(1),
  rootId: z.string().min(1).max(80),
  nodes: z.record(z.string(), nodeSchema),
  edges: z.record(z.string(), edgeSchema),
  layout: z.object({
    orientation: z.enum(["balanced", "right", "left", "down", "up", "radial"]),
    density: z.enum(["compact", "comfortable", "expanded"]),
    horizontalGap: z.number().min(8).max(240),
    verticalGap: z.number().min(0).max(160),
    rootGap: z.number().min(8).max(280),
    levelGap: z.number().min(0).max(80),
  }),
  updatedAt: z.string().min(1).max(40),
});

export function parseDocument(
  input: unknown,
): { ok: true; document: MindMapDocument } | { ok: false; error: string } {
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That file isn't a valid Arbour map." };
  return normalizeDocument(parsed.data);
}
