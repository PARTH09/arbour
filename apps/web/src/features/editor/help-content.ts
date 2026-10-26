export type HelpSectionId =
  | "start"
  | "tools"
  | "editing"
  | "layout"
  | "import"
  | "translate"
  | "share"
  | "shortcuts"
  | "faq";

export type HelpBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "steps"; title?: string; items: string[] }
  | { type: "bullets"; title?: string; items: string[] }
  | { type: "callout"; tone: "tip" | "note" | "warning"; text: string };

export type HelpArticle = {
  id: string;
  title: string;
  /** Short line for search results and category lists. */
  summary: string;
  blocks: HelpBlock[];
};

export type HelpSection = {
  id: HelpSectionId;
  label: string;
  blurb: string;
  intro: string;
  articles: HelpArticle[];
};

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "start",
    label: "Getting started",
    blurb: "Get to know Arbour at a high level so you can start mapping.",
    intro: "Arbour keeps mind maps on this device. Start here if you are opening the product for the first time.",
    articles: [
      {
        id: "new-map",
        title: "Create a new map",
        summary: "Start from a blank canvas or a template with a central topic ready to expand.",
        blocks: [
          {
            type: "paragraph",
            text: "Every map begins with a central topic. From there you add branches, rearrange ideas, and style topics as the structure grows.",
          },
          {
            type: "steps",
            title: "Create from the library",
            items: [
              "Open the library sidebar if it is hidden.",
              "Click New map to create a blank document, or open Templates and pick a starter.",
              "The new map opens on the canvas with the central topic selected.",
            ],
          },
          {
            type: "bullets",
            title: "Next steps",
            items: [
              "Double-click the central topic to rename it.",
              "Press Tab (or use + on the tool rail) to add the first child.",
              "Open Sample examples under Templates if you want import or translate practice data.",
            ],
          },
          {
            type: "callout",
            tone: "tip",
            text: "Maps save automatically in this browser. Export JSON if you need a backup or want to move work to another device.",
          },
        ],
      },
      {
        id: "select-topic",
        title: "Select a topic",
        summary: "Selection controls where new children attach and which topics the format bar edits.",
        blocks: [
          {
            type: "paragraph",
            text: "Almost every edit in Arbour applies to the current selection. Keeping the right topic selected makes keyboard shortcuts and formatting predictable.",
          },
          {
            type: "steps",
            title: "Ways to select",
            items: [
              "Click a topic on the canvas.",
              "Press V to enter Select mode, then click.",
              "Use the arrow keys to move selection between neighboring topics.",
              "Drag on empty canvas to rubber-band select multiple topics.",
            ],
          },
          {
            type: "callout",
            tone: "note",
            text: "New children attach under the first selected topic. If nothing is selected, they attach under the central topic.",
          },
        ],
      },
      {
        id: "auto-save",
        title: "How saving works",
        summary: "Edits write to this browser automatically — there is no separate Save button.",
        blocks: [
          {
            type: "paragraph",
            text: "Arbour stores maps in local browser storage on this device. The status near the document title shows when a write is in progress or complete.",
          },
          {
            type: "bullets",
            title: "Good practice",
            items: [
              "Export JSON periodically for important maps.",
              "Clearing site data for this origin removes local maps.",
              "Roles and folders also stay on this device — they are not a live cloud share link.",
            ],
          },
        ],
      },
      {
        id: "first-branch",
        title: "Add your first branch",
        summary: "Grow the tree from the center with rounded topics and branch colors.",
        blocks: [
          {
            type: "paragraph",
            text: "Children of the central topic receive distinct branch colors. Deeper topics inherit that branch’s soft fill so related ideas stay visually grouped.",
          },
          {
            type: "steps",
            items: [
              "Select the central topic (or any parent).",
              "Press Tab, or click + on the left tool rail.",
              "Type a label and press Enter to add a sibling, or Tab again for another child.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "tools",
    label: "Canvas tools",
    blurb: "Select, pan, add topics, link, translate, and more from the left rail.",
    intro: "The left tool rail switches canvas modes and opens frequent map actions.",
    articles: [
      {
        id: "tool-select",
        title: "Select tool",
        summary: "Click, multi-select, and drag topics. Shortcut: V.",
        blocks: [
          {
            type: "paragraph",
            text: "Select is the default mode for editing. Use it to move topics, open the format bar, and prepare a parent for new children.",
          },
          {
            type: "steps",
            items: [
              "Press V or click the pointer icon on the left rail.",
              "Click a topic to select it, or drag across several topics.",
              "Drag a topic onto another topic to reparent it.",
            ],
          },
        ],
      },
      {
        id: "tool-pan",
        title: "Pan the canvas",
        summary: "Move around large maps without changing selection. Shortcut: Space.",
        blocks: [
          {
            type: "paragraph",
            text: "Pan mode moves the viewport only. Your selection and open editors stay as they are.",
          },
          {
            type: "steps",
            items: [
              "Hold Space and drag, or choose the hand tool.",
              "Scroll the trackpad or mouse wheel to pan while remaining in Select mode.",
            ],
          },
        ],
      },
      {
        id: "tool-add",
        title: "Add a topic",
        summary: "Insert a child under the selection with a rounded fill. Shortcut: Tab.",
        blocks: [
          {
            type: "paragraph",
            text: "New topics are created as rounded cards with a soft background that follows the parent branch color.",
          },
          {
            type: "steps",
            items: [
              "Select a parent topic.",
              "Click + on the tool rail, or press Tab.",
              "Type the label. Enter adds a sibling; Alt+Enter inserts a parent above.",
            ],
          },
        ],
      },
      {
        id: "tool-link",
        title: "Add a cross-link",
        summary: "Connect two topics with a dashed relationship that is not part of the tree.",
        blocks: [
          {
            type: "paragraph",
            text: "Cross-links express relationships that sit outside the parent–child hierarchy — for example, “depends on” or “related to.”",
          },
          {
            type: "steps",
            items: [
              "Choose the cross-link tool on the left rail.",
              "Drag from a handle on one topic to another topic.",
              "Select the link later to change color, dash style, or label from the format bar.",
            ],
          },
        ],
      },
      {
        id: "tool-note",
        title: "Notes, text, and images",
        summary: "Add sticky notes, borderless text, or image cards beside the tree.",
        blocks: [
          {
            type: "paragraph",
            text: "Not every idea belongs in the same topic shape. Notes, text, and images let you annotate the map without forcing everything into a branch card.",
          },
          {
            type: "bullets",
            items: [
              "Note — yellow sticky-style card for comments and asides.",
              "Text — borderless label for lightweight annotations.",
              "Image — upload a small file from this device or paste an https link.",
            ],
          },
          {
            type: "callout",
            tone: "note",
            text: "Keep image uploads under 750 KB so maps stay light in browser storage.",
          },
        ],
      },
      {
        id: "tool-translate",
        title: "Translate the map",
        summary: "Rename every visible topic into another language in one pass.",
        blocks: [
          {
            type: "paragraph",
            text: "Translate updates topic labels only. Hierarchy, colors, and layout stay intact so you can review structure in another language.",
          },
          {
            type: "steps",
            items: [
              "Open Translate from the tool rail or Options.",
              "Choose a target language (and source language if auto-detect is wrong).",
              "Confirm. Use Undo once to restore the previous wording for the whole map.",
            ],
          },
          {
            type: "callout",
            tone: "tip",
            text: "Translation usually needs a network connection. Some browsers can use a built-in Translator API when available.",
          },
        ],
      },
      {
        id: "tool-collapse",
        title: "Collapse or expand branches",
        summary: "Hide detail on busy maps, globally or one branch at a time.",
        blocks: [
          {
            type: "paragraph",
            text: "Parents with children show a chevron on the outer side of the topic. Collapsing hides that subtree until you expand it again.",
          },
          {
            type: "bullets",
            items: [
              "Click a topic’s chevron to collapse or expand that branch.",
              "Use the fold control on the tool rail (or ⌘⇧/) to collapse or expand every branch at once.",
              "⌘/ toggles collapse for the current selection.",
            ],
          },
        ],
      },
      {
        id: "tool-tidy",
        title: "Tidy layout",
        summary: "Recompute positions so branches no longer overlap.",
        blocks: [
          {
            type: "paragraph",
            text: "After heavy editing, topics can drift. Tidy runs the layout engine again while preserving tree structure.",
          },
          {
            type: "steps",
            items: [
              "Click the sparkles control on the tool rail, or choose Options → Tidy layout.",
              "Review the result. Floating (detached) topics keep the positions you set manually.",
            ],
          },
        ],
      },
      {
        id: "tool-import",
        title: "Import from the tool rail",
        summary: "Open the file picker for PDF, Markdown, text, or JSON maps.",
        blocks: [
          {
            type: "paragraph",
            text: "The upload control on the left rail is the fastest path into document import while you are already on the canvas.",
          },
          {
            type: "callout",
            tone: "note",
            text: "For full details on supported formats and structure rules, see Imports & exports → Import PDF or outline.",
          },
        ],
      },
    ],
  },
  {
    id: "editing",
    label: "Editing topics",
    blurb: "Rename, reparent, format, collapse, and delete with the keyboard or mouse.",
    intro: "Day-to-day editing once a map is open.",
    articles: [
      {
        id: "rename",
        title: "Rename a topic",
        summary: "Change the label shown on the canvas.",
        blocks: [
          {
            type: "steps",
            items: [
              "Double-click the topic, or select it and press F2.",
              "Edit the text. Enter confirms; Esc restores the previous label.",
              "Shift+Enter inserts a line break while editing.",
            ],
          },
        ],
      },
      {
        id: "reparent",
        title: "Move a topic under another parent",
        summary: "Change hierarchy by dragging or using Move under…",
        blocks: [
          {
            type: "paragraph",
            text: "Reparenting moves a topic and its entire subtree. Branch styling updates to match the new parent’s branch when inheritance applies.",
          },
          {
            type: "steps",
            items: [
              "Drag a topic onto a new parent until the drop target highlights.",
              "Or open the context menu → Move under… and pick a parent from the list.",
            ],
          },
          {
            type: "callout",
            tone: "tip",
            text: "Hold Option (Alt) while dragging to duplicate the subtree instead of moving it.",
          },
        ],
      },
      {
        id: "format-bar",
        title: "Format topics and connectors",
        summary: "Shape, color, type, and connector path from the floating format bar.",
        blocks: [
          {
            type: "paragraph",
            text: "When one or more topics (or a connector) are selected, a format bar appears near the top of the canvas.",
          },
          {
            type: "bullets",
            title: "Common controls",
            items: [
              "Shape — rounded, rectangle, pill, ellipse, underline, or borderless.",
              "Fill, text, and border colors.",
              "Font family, size, weight, and alignment.",
              "On connectors — Curve, Line, or Elbow, plus stroke and dash.",
            ],
          },
        ],
      },
      {
        id: "collapse-one",
        title: "Collapse a single branch",
        summary: "Hide one parent’s children without affecting the rest of the map.",
        blocks: [
          {
            type: "steps",
            items: [
              "Click the chevron on the outer side of a parent topic.",
              "Or select the parent and press ⌘/ (Ctrl+/).",
            ],
          },
        ],
      },
      {
        id: "delete",
        title: "Delete topics or links",
        summary: "Remove content from the map. The central topic is protected.",
        blocks: [
          {
            type: "steps",
            items: [
              "Select one or more topics, or select a cross-link.",
              "Press Delete or Backspace.",
            ],
          },
          {
            type: "callout",
            tone: "warning",
            text: "Deleting a parent removes its subtree. Undo restores the last removal if you change your mind.",
          },
        ],
      },
    ],
  },
  {
    id: "layout",
    label: "Layout & view",
    blurb: "Direction, spacing, zoom, grid, outline, and light/dark chrome.",
    intro: "Control how the tree is arranged and what chrome surrounds the canvas.",
    articles: [
      {
        id: "direction",
        title: "Choose a map direction",
        summary: "Balanced, horizontal, vertical, or radial layouts.",
        blocks: [
          {
            type: "paragraph",
            text: "Layout direction controls which side of the center new branches prefer, and how tidy layout places the tree.",
          },
          {
            type: "steps",
            items: [
              "Open Layout in the top toolbar.",
              "Pick Balanced, Left to right, Right to left, Top to bottom, Bottom to top, or Radial.",
              "Run Tidy layout if branches overlap after switching direction.",
            ],
          },
        ],
      },
      {
        id: "spacing",
        title: "Adjust spacing",
        summary: "Compact, comfortable, or expanded gaps between topics.",
        blocks: [
          {
            type: "paragraph",
            text: "Spacing presets change horizontal and vertical gaps. Even vs stepped levels adjust how depth is distributed.",
          },
          {
            type: "steps",
            items: ["Open Layout → Spacing and choose a density.", "Optionally set Even levels or Stepped levels, then tidy."],
          },
        ],
      },
      {
        id: "zoom",
        title: "Zoom and fit",
        summary: "Focus the viewport on the whole map or the current selection.",
        blocks: [
          {
            type: "bullets",
            items: [
              "+ / − or the toolbar zoom controls change scale.",
              "Click the zoom percentage to reset to 100%.",
              "Fit frames the entire map; shortcuts 0, 1, and 2 cover reset and fit variants.",
              "Map in the corner toggles the minimap.",
            ],
          },
        ],
      },
      {
        id: "view-toggles",
        title: "Grid, outline, and theme",
        summary: "Canvas aids and light/dark application chrome.",
        blocks: [
          {
            type: "paragraph",
            text: "These controls change the editor chrome. They do not rewrite branch colors on the map itself — use Themes under Options for that.",
          },
          {
            type: "bullets",
            items: [
              "Grid — dotted background for alignment.",
              "Outline — hierarchical list of topics on the right.",
              "Sun / moon — light or dark application theme.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "import",
    label: "Imports & exports",
    blurb: "Bring documents in; take JSON, SVG, PNG, or outlines out.",
    intro: "Move structured writing and finished visuals between Arbour and other tools.",
    articles: [
      {
        id: "import-pdf",
        title: "Import PDF or outline",
        summary: "Turn documents, Markdown, and text PDFs into a mind-map tree.",
        blocks: [
          {
            type: "paragraph",
            text: "Import builds a new tree from an existing document so you do not have to recreate headings and bullets by hand. Arbour reads structure from outlines when it can, and falls back to paragraph-based grouping for prose.",
          },
          {
            type: "heading",
            text: "Supported files",
          },
          {
            type: "bullets",
            items: [
              "Markdown (.md) — headings and lists become nested topics.",
              "Plain text (.txt) — indented outlines or prose paragraphs.",
              "PDF — text-based PDFs only; scanned pages need OCR before import.",
              "JSON — maps previously exported from Arbour.",
            ],
          },
          {
            type: "heading",
            text: "Import a document",
          },
          {
            type: "steps",
            items: [
              "Click the upload control on the left tool rail, or choose Options → Import PDF / outline.",
              "Select a file under 8 MB.",
              "Review the generated map. Rename the central topic if the inferred title is too generic.",
              "Use Tidy layout if branches need spacing after a large import.",
            ],
          },
          {
            type: "heading",
            text: "How structure is inferred",
          },
          {
            type: "bullets",
            items: [
              "Markdown headings and indented bullets map directly to parent/child depth.",
              "Numbered or bulleted lists nest under the preceding heading when present.",
              "Prose without clear outline markers is split into sections and supporting points.",
              "Empty or image-only PDFs cannot produce topics until text is available.",
            ],
          },
          {
            type: "callout",
            tone: "tip",
            text: "Try Templates → Sample examples for a product-plan PDF, Hindi and Gujarati outlines, and Whimsical-style Markdown.",
          },
          {
            type: "callout",
            tone: "warning",
            text: "Import replaces the contents of the map you currently have open. Duplicate the map first if you need to keep the previous version.",
          },
        ],
      },
      {
        id: "samples",
        title: "Sample examples",
        summary: "Load curated PDF and outline samples without leaving the app.",
        blocks: [
          {
            type: "paragraph",
            text: "Sample examples are small fixtures for demos and QA — product plans, localized outlines, and Whimsical-style Markdown.",
          },
          {
            type: "steps",
            items: [
              "Open the library → Templates.",
              "Under Sample examples, pick a file type to load.",
              "Or use Options → Open sample… from the canvas toolbar.",
            ],
          },
        ],
      },
      {
        id: "export",
        title: "Export a map",
        summary: "Download JSON, outline text, SVG, or PNG.",
        blocks: [
          {
            type: "paragraph",
            text: "Export is how you back up work or send a map outside this browser.",
          },
          {
            type: "bullets",
            items: [
              "JSON — full editable backup for Arbour.",
              "Outline — indented text for docs or other outline tools.",
              "SVG / PNG — visuals for slides and specs.",
            ],
          },
          {
            type: "steps",
            items: ["Click the download icon in the top toolbar.", "Choose a format. The file downloads to your device."],
          },
        ],
      },
    ],
  },
  {
    id: "translate",
    label: "Translate",
    blurb: "Rename every visible topic into another language in one pass.",
    intro: "Localization helpers for maps that need English, Hindi, Gujarati, and other labels.",
    articles: [
      {
        id: "translate-map",
        title: "Translate topic labels",
        summary: "Run a bulk rename across visible topics while keeping structure intact.",
        blocks: [
          {
            type: "paragraph",
            text: "Use translate when stakeholders need the same map in another language. Connectors, colors, and hierarchy are unchanged.",
          },
          {
            type: "steps",
            title: "Run a translation",
            items: [
              "Open Translate from the tool rail or Options → Translate map…",
              "Set the target language. Adjust source language if auto-detect misreads the map.",
              "Confirm and wait for the progress banner to finish.",
              "Spot-check critical topics. Press Undo once to revert the entire translation if needed.",
            ],
          },
          {
            type: "callout",
            tone: "note",
            text: "Only visible topics are translated. Expand collapsed branches first if those labels should be included.",
          },
        ],
      },
    ],
  },
  {
    id: "share",
    label: "Share & access",
    blurb: "Roles on this device, folders, and sending a file to someone else.",
    intro: "Access control here is local to this browser until you export a file.",
    articles: [
      {
        id: "share-map",
        title: "Share a map or folder",
        summary: "Grant viewer or editor access to people already on this device.",
        blocks: [
          {
            type: "paragraph",
            text: "Share is designed for multiple people using the same browser profile — for example a shared workstation — not for live internet links.",
          },
          {
            type: "steps",
            items: [
              "Add people under Settings if they are not listed yet.",
              "Click Share on the map (or share a folder from the library).",
              "Assign viewer or editor roles as needed.",
            ],
          },
        ],
      },
      {
        id: "send-file",
        title: "Send a map to someone else",
        summary: "Export a file when the recipient is not on this browser.",
        blocks: [
          {
            type: "paragraph",
            text: "Until cloud links exist, the reliable handoff is an exported file.",
          },
          {
            type: "steps",
            items: [
              "Export JSON for an editable copy, or PNG/SVG for a snapshot.",
              "Send the file through your usual channel (email, drive, chat).",
              "The recipient imports JSON via Import, or opens the image elsewhere.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "shortcuts",
    label: "Keyboard shortcuts",
    blurb: "Keep your hands on the keyboard and move through the map faster.",
    intro: "Shortcuts are paused while the cursor is inside a topic text field.",
    articles: [
      {
        id: "shortcuts-overview",
        title: "Using keyboard shortcuts",
        summary: "Open this list anytime with ?, and use modifiers while navigating the tree.",
        blocks: [
          {
            type: "paragraph",
            text: "Arbour mirrors common outline editors: Tab for children, Enter for siblings, and modifier keys for structure changes. The full list appears below this article when you open the Keyboard shortcuts category.",
          },
          {
            type: "callout",
            tone: "tip",
            text: "Press ? from the canvas to jump straight here. Esc closes Help.",
          },
        ],
      },
    ],
  },
  {
    id: "faq",
    label: "FAQs",
    blurb: "Quick answers about storage, connectors, colors, and offline translate.",
    intro: "Short answers to common product questions.",
    articles: [
      {
        id: "faq-data",
        title: "Where is my data stored?",
        summary: "Maps live in this browser’s local storage on this device.",
        blocks: [
          {
            type: "paragraph",
            text: "Arbour does not sync to a cloud workspace yet. Everything you create stays in this browser origin until you export or clear site data.",
          },
          {
            type: "callout",
            tone: "warning",
            text: "Clearing cookies/site data for this app removes local maps. Export JSON for anything you cannot afford to lose.",
          },
        ],
      },
      {
        id: "faq-curves",
        title: "Why are connectors curved by default?",
        summary: "New branch lines use curves for readability; you can switch per connector.",
        blocks: [
          {
            type: "paragraph",
            text: "Curved connectors reduce visual clutter on balanced maps. Select any connector and use the format bar to switch to a straight line or elbow.",
          },
        ],
      },
      {
        id: "faq-colors",
        title: "How do branch colors work?",
        summary: "Each child of the center takes the next palette color; deeper topics inherit it.",
        blocks: [
          {
            type: "paragraph",
            text: "Root-level branches cycle through Arbour’s branch palette. Children inherit that border and soft fill unless you override them in the format bar or apply a document theme.",
          },
        ],
      },
      {
        id: "faq-offline",
        title: "Does translate work offline?",
        summary: "Usually you need a network connection unless the browser provides a local translator.",
        blocks: [
          {
            type: "paragraph",
            text: "If translation fails, check connectivity and try again. A partial run can be reverted with a single Undo.",
          },
        ],
      },
    ],
  },
];

export function articleSearchText(article: HelpArticle): string {
  return article.blocks
    .map((block) => {
      if (block.type === "paragraph" || block.type === "heading" || block.type === "callout") return block.text;
      if (block.type === "steps" || block.type === "bullets") {
        return `${block.title ?? ""} ${block.items.join(" ")}`;
      }
      return "";
    })
    .join(" ");
}

export function searchHelp(query: string): { section: HelpSection; article: HelpArticle }[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const hits: { section: HelpSection; article: HelpArticle }[] = [];
  for (const section of HELP_SECTIONS) {
    for (const article of section.articles) {
      const hay = `${section.label} ${article.title} ${article.summary} ${articleSearchText(article)}`.toLowerCase();
      if (hay.includes(needle)) hits.push({ section, article });
    }
  }
  return hits;
}
