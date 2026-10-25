import type {
  EdgeStyle,
  FontFamily,
  LayoutDensity,
  LayoutSettings,
  MindNode,
  NodeStyle,
  NodeType,
} from "./types";

export const NODE_METRICS = {
  maxTextWidth: 220,
  noteMaxTextWidth: 280,
  minWidth: 76,
  paddingX: 14,
  paddingY: 8,
  border: 1.5,
  lineHeight: 1.35,
  charRatio: 0.52,
} as const;

export const BRANCH_COLORS = [
  "#0f6e56",
  "#c2410c",
  "#1d4ed8",
  "#6d28d9",
  "#b45309",
  "#be123c",
  "#0e7490",
  "#3f6212",
] as const;

/** Soft fills paired with BRANCH_COLORS — never white, so new topics read like Whimsical branches. */
export const BRANCH_FILLS = [
  "#dff3ec",
  "#fde8dc",
  "#e4ecfd",
  "#eee4fd",
  "#faf0d8",
  "#fce4ec",
  "#daf3f7",
  "#e8f0d8",
] as const;

export const PALETTE = [
  { name: "Grove", value: "#0f6e56" },
  { name: "Ember", value: "#c2410c" },
  { name: "Sea", value: "#1d4ed8" },
  { name: "Iris", value: "#6d28d9" },
  { name: "Amber", value: "#b45309" },
  { name: "Rose", value: "#be123c" },
  { name: "Tide", value: "#0e7490" },
  { name: "Olive", value: "#3f6212" },
  { name: "Ink", value: "#1c1917" },
  { name: "Stone", value: "#78716c" },
  { name: "Paper", value: "#ffffff" },
  { name: "Sand", value: "#f4efe4" },
] as const;

export const FONT_OPTIONS: { id: FontFamily; label: string }[] = [
  { id: "sans", label: "Source Sans" },
  { id: "serif", label: "Georgia" },
  { id: "mono", label: "Plex Mono" },
];

export const DENSITY_PRESETS: Record<
  LayoutDensity,
  Pick<LayoutSettings, "horizontalGap" | "verticalGap" | "rootGap" | "levelGap">
> = {
  compact: { horizontalGap: 36, verticalGap: 10, rootGap: 52, levelGap: 0 },
  comfortable: { horizontalGap: 56, verticalGap: 18, rootGap: 72, levelGap: 0 },
  expanded: { horizontalGap: 88, verticalGap: 32, rootGap: 104, levelGap: 0 },
};

export interface MapTheme {
  id: string;
  name: string;
  description: string;
  root: Partial<NodeStyle>;
  branch: Partial<NodeStyle>;
  note: Partial<NodeStyle>;
}

/**
 * Style precedence, applied in this order:
 * 1. Document theme writes unlocked nodes.
 * 2. A new child copies its parent's fill, border color, and font.
 *    Children of the central topic take the next branch color and soft fill.
 * 3. A manual edit sets `themeLock`, so later themes leave that node alone.
 * Tree connectors follow the target border color until their own color is set.
 */
export const THEMES: MapTheme[] = [
  {
    id: "grove",
    name: "Grove",
    description: "Ink center, paper topics, branch colors",
    root: {
      shape: "rounded",
      background: "#1c1917",
      color: "#fafaf9",
      borderColor: "#1c1917",
      borderWidth: 1.5,
      shadow: "soft",
    },
    branch: {
      color: "#1c1917",
      shadow: "soft",
    },
    note: {
      background: "#fff7d6",
      color: "#1c1917",
      borderColor: "#d6b656",
    },
  },
  {
    id: "ink",
    name: "Ink",
    description: "Dark topics with light type",
    root: {
      background: "#0c0a09",
      color: "#fafaf9",
      borderColor: "#0c0a09",
    },
    branch: {
      background: "#292524",
      color: "#fafaf9",
      shadow: "none",
    },
    note: {
      background: "#44403c",
      color: "#fafaf9",
      borderColor: "#a8a29e",
    },
  },
  {
    id: "paper",
    name: "Paper",
    description: "Quiet stone outlines",
    root: {
      background: "#ffffff",
      color: "#1c1917",
      borderColor: "#1c1917",
    },
    branch: {
      background: "#ffffff",
      color: "#1c1917",
      borderColor: "#d6d3d1",
      shadow: "soft",
    },
    note: {
      background: "#fafaf9",
      color: "#1c1917",
      borderColor: "#d6d3d1",
    },
  },
  {
    id: "dusk",
    name: "Dusk",
    description: "Indigo center and bright branches",
    root: {
      background: "#312e81",
      color: "#eef2ff",
      borderColor: "#312e81",
    },
    branch: {
      background: "#ffffff",
      color: "#1e1b4b",
      shadow: "soft",
    },
    note: {
      background: "#eef2ff",
      color: "#1e1b4b",
      borderColor: "#a5b4fc",
    },
  },
];

export function defaultLayout(): LayoutSettings {
  return {
    orientation: "balanced",
    density: "comfortable",
    ...DENSITY_PRESETS.comfortable,
  };
}

export function defaultTopicStyle(): NodeStyle {
  return {
    shape: "rounded",
    background: "#ffffff",
    color: "#1c1917",
    borderColor: BRANCH_COLORS[0],
    borderWidth: NODE_METRICS.border,
    borderStyle: "solid",
    opacity: 1,
    fontFamily: "sans",
    fontSize: 14,
    fontWeight: 500,
    fontStyle: "normal",
    textDecoration: "none",
    textAlign: "center",
    shadow: "soft",
    themeLock: false,
  };
}

export function rootStyle(): NodeStyle {
  return {
    ...defaultTopicStyle(),
    background: "#1c1917",
    color: "#fafaf9",
    borderColor: "#1c1917",
    fontSize: 18,
    fontWeight: 600,
    themeLock: false,
  };
}

export function defaultEdgeStyle(stroke: string, kind: "tree" | "link"): EdgeStyle {
  if (kind === "link") {
    return {
      path: "bezier",
      stroke: "#78716c",
      strokeWidth: 1.5,
      lineStyle: "dashed",
      marker: "arrow",
      followNode: false,
    };
  }
  return {
    path: "bezier",
    stroke,
    strokeWidth: 2,
    lineStyle: "solid",
    marker: "none",
    followNode: true,
  };
}

export function styleForChild(
  parent: MindNode,
  isRootChild: boolean,
  rootChildIndex: number,
  nodeType: NodeType,
): NodeStyle {
  const style = defaultTopicStyle();
  style.fontFamily = parent.style.fontFamily;
  style.fontSize = isRootChild ? 14 : parent.style.fontSize;
  const colorIndex = rootChildIndex % BRANCH_COLORS.length;
  style.borderColor = BRANCH_COLORS[colorIndex];
  style.background = BRANCH_FILLS[colorIndex];

  if (nodeType === "note") {
    style.background = "#fff7d6";
    style.borderColor = "#d6b656";
    style.textAlign = "left";
    style.fontWeight = 400;
  } else if (nodeType === "text") {
    style.shape = "borderless";
    style.background = "transparent";
    style.borderStyle = "none";
    style.borderWidth = 0;
    style.shadow = "none";
    style.textAlign = "left";
    style.fontWeight = 400;
  } else if (nodeType === "image") {
    style.textAlign = "left";
    style.fontSize = 13;
  }

  return style;
}

export function measureNode(
  node: Pick<MindNode, "text" | "note" | "style" | "nodeType" | "emoji" | "tags" | "imageUrl">,
): { width: number; height: number } {
  const fontSize = node.style.fontSize;
  const ratio = node.style.fontFamily === "mono" ? 0.6 : NODE_METRICS.charRatio;
  const maxText =
    node.nodeType === "note" ? NODE_METRICS.noteMaxTextWidth : NODE_METRICS.maxTextWidth;
  const border = node.style.borderStyle === "none" ? 0 : node.style.borderWidth;

  const wrapCount = (text: string, size: number) => {
    if (!text.trim()) return 0;
    let lines = 0;
    for (const line of text.split("\n")) {
      const width = Math.max(line.length, 1) * size * ratio;
      lines += Math.max(1, Math.ceil(width / maxText));
    }
    return lines;
  };

  const label = `${node.emoji ? `${node.emoji} ` : ""}${node.text || " "}`;
  const textLines = Math.max(1, wrapCount(label, fontSize));
  const noteLines = wrapCount(node.note, Math.max(11, fontSize - 2));
  let textWidth = NODE_METRICS.minWidth - NODE_METRICS.paddingX * 2;
  for (const line of label.split("\n")) {
    textWidth = Math.max(textWidth, Math.min(maxText, line.length * fontSize * ratio));
  }
  if (node.note) {
    for (const line of node.note.split("\n")) {
      textWidth = Math.max(textWidth, Math.min(maxText, line.length * (fontSize - 2) * ratio));
    }
  }

  const tagRow = node.tags.length ? 22 : 0;
  const imageRow = node.imageUrl ? 104 : 0;
  const noteHeight = noteLines ? noteLines * Math.max(11, fontSize - 2) * NODE_METRICS.lineHeight + 4 : 0;
  let width = textWidth + NODE_METRICS.paddingX * 2 + border * 2;
  let height =
    NODE_METRICS.paddingY * 2 +
    border * 2 +
    textLines * fontSize * NODE_METRICS.lineHeight +
    noteHeight +
    tagRow +
    imageRow;

  width = Math.max(NODE_METRICS.minWidth, Math.min(maxText + NODE_METRICS.paddingX * 2 + border * 2, width));
  height = Math.max(40, height);

  if (node.style.shape === "ellipse") {
    width = Math.max(width, 96);
    height = Math.max(height, 52);
  }
  if (node.style.shape === "pill") {
    height = Math.max(height, 44);
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

export function fontStack(family: FontFamily): string {
  if (family === "serif") return "Georgia, 'Iowan Old Style', serif";
  if (family === "mono") return "'IBM Plex Mono', ui-monospace, monospace";
  return "'Source Sans 3', ui-sans-serif, system-ui, sans-serif";
}
