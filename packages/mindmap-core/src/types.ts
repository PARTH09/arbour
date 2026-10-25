export const SCHEMA_VERSION = 1 as const;

export const MAX_NODES = 5000;
export const MAX_TEXT = 2000;
export const MAX_NOTE = 500;
export const MAX_TAG = 24;
export const MAX_TAGS = 8;
export const MAX_EMOJI = 8;

export type NodeId = string;
export type EdgeId = string;
export type DocumentId = string;

export type NodeType = "topic" | "note" | "text" | "image";
export type NodeShape =
  | "rounded"
  | "rectangle"
  | "pill"
  | "ellipse"
  | "underline"
  | "borderless";
export type FontFamily = "sans" | "serif" | "mono";
export type TextAlign = "left" | "center" | "right";
export type BorderLine = "solid" | "dashed" | "dotted" | "none";
export type ShadowStyle = "none" | "soft";
export type Side = "left" | "right";

export type EdgeKind = "tree" | "link";
export type EdgePath = "bezier" | "straight" | "orthogonal";
export type LineStyle = "solid" | "dashed" | "dotted";
export type EdgeMarker = "none" | "arrow";

export type LayoutOrientation =
  | "balanced"
  | "right"
  | "left"
  | "down"
  | "up"
  | "radial";

export type LayoutDensity = "compact" | "comfortable" | "expanded";

export interface Point {
  x: number;
  y: number;
}

export interface NodeStyle {
  shape: NodeShape;
  background: string;
  color: string;
  borderColor: string;
  borderWidth: number;
  borderStyle: BorderLine;
  opacity: number;
  fontFamily: FontFamily;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  fontStyle: "normal" | "italic";
  textDecoration: "none" | "underline";
  textAlign: TextAlign;
  shadow: ShadowStyle;
  /**
   * When true, document themes skip this node.
   * Manual formatting sets the lock so a later theme does not wipe an override.
   */
  themeLock: boolean;
}

export interface EdgeStyle {
  path: EdgePath;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  marker: EdgeMarker;
  /** Tree connectors follow the target topic's border until the user picks a color. */
  followNode: boolean;
}

export interface MindNode {
  id: NodeId;
  parentId: NodeId | null;
  text: string;
  nodeType: NodeType;
  side: Side;
  sortOrder: number;
  collapsed: boolean;
  floating: boolean;
  position: Point;
  width: number;
  height: number;
  style: NodeStyle;
  note: string;
  href: string | null;
  tags: string[];
  emoji: string;
  imageUrl: string | null;
}

export interface MindEdge {
  id: EdgeId;
  sourceId: NodeId;
  targetId: NodeId;
  kind: EdgeKind;
  label: string;
  style: EdgeStyle;
}

export interface LayoutSettings {
  orientation: LayoutOrientation;
  density: LayoutDensity;
  horizontalGap: number;
  verticalGap: number;
  rootGap: number;
  /** Extra main-axis space added at each depth below the root. */
  levelGap: number;
}

export interface MindMapDocument {
  id: DocumentId;
  title: string;
  schemaVersion: number;
  rootId: NodeId;
  nodes: Record<NodeId, MindNode>;
  edges: Record<EdgeId, MindEdge>;
  layout: LayoutSettings;
  updatedAt: string;
}

export interface SubtreeSnapshot {
  rootId: NodeId;
  nodes: MindNode[];
  edges: MindEdge[];
}

export type Command =
  | { type: "setTitle"; title: string }
  | {
      type: "addChild";
      parentId: NodeId;
      text?: string;
      nodeType?: NodeType;
      side?: Side;
      imageUrl?: string | null;
    }
  | {
      type: "addSibling";
      nodeId: NodeId;
      text?: string;
      nodeType?: NodeType;
      placement?: "above" | "below";
    }
  | {
      type: "addParent";
      nodeId: NodeId;
      text?: string;
      nodeType?: NodeType;
    }
  | {
      type: "addFloating";
      position: Point;
      text?: string;
      nodeType?: NodeType;
      imageUrl?: string | null;
    }
  | { type: "deleteNodes"; ids: NodeId[] }
  | { type: "rename"; nodeId: NodeId; text: string }
  | {
      type: "reparent";
      nodeId: NodeId;
      parentId: NodeId;
      index?: number;
      side?: Side;
    }
  | { type: "reorder"; nodeId: NodeId; index: number }
  | { type: "setSide"; nodeId: NodeId; side: Side }
  | { type: "promote"; nodeId: NodeId }
  | { type: "toggleCollapse"; nodeId: NodeId }
  | { type: "duplicate"; nodeId: NodeId }
  | {
      type: "patchNodes";
      ids: NodeId[];
      style?: Partial<NodeStyle>;
      note?: string;
      href?: string | null;
      tags?: string[];
      emoji?: string;
      imageUrl?: string | null;
      nodeType?: NodeType;
    }
  | { type: "paintSubtree"; nodeId: NodeId; borderColor: string }
  | {
      type: "patchEdges";
      ids: EdgeId[];
      style?: Partial<EdgeStyle>;
      label?: string;
    }
  | { type: "addLink"; sourceId: NodeId; targetId: NodeId }
  | { type: "deleteEdges"; ids: EdgeId[] }
  | { type: "pasteOutline"; parentId: NodeId; outline: string }
  | { type: "pasteSubtree"; parentId: NodeId; snapshot: SubtreeSnapshot }
  | { type: "setLayout"; layout: Partial<LayoutSettings> }
  | { type: "relayout" }
  | { type: "applyTheme"; themeId: string }
  | { type: "moveFloating"; nodeId: NodeId; position: Point }
  | { type: "nudge"; nodeId: NodeId; dx: number; dy: number }
  | { type: "replaceDocument"; document: MindMapDocument };

export interface CommandResult {
  document: MindMapDocument;
  changed: boolean;
  focusId?: NodeId;
  error?: string;
}

export interface ApplyContext {
  createId?: () => string;
  now?: () => string;
}
