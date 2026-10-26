import { applyCommand } from "./commands";
import { createDocument } from "./document";
import type { ApplyContext, MindMapDocument, NodeType, Side } from "./types";

interface TemplateBranch {
  text: string;
  nodeType?: NodeType;
  children?: TemplateBranch[];
}

interface TemplateDefinition {
  id: string;
  title: string;
  description: string;
  root: string;
  branches: (TemplateBranch & { side: Side })[];
}

const TEMPLATES: TemplateDefinition[] = [
  {
    id: "brainstorm",
    title: "Brainstorming",
    description: "Open a topic into options, constraints, and next steps.",
    root: "New idea",
    branches: [
      { side: "right", text: "Audience", children: text("Who it's for", "The problem", "What they do today") },
      { side: "right", text: "Possibilities", children: text("Obvious options", "Wild options", "Combinations") },
      { side: "left", text: "Constraints", children: text("Time", "Cost", "What must stay true") },
      { side: "left", text: "Next steps", children: text("Decide", "Assign", "Review") },
    ],
  },
  {
    id: "product-strategy",
    title: "Product strategy",
    description: "Connect the customer, the problem, the bet, and the evidence.",
    root: "Product strategy",
    branches: [
      { side: "right", text: "Customers", children: text("Segment", "Job to be done", "Alternatives") },
      { side: "right", text: "Problem", children: text("Pain", "Frequency", "Stakes") },
      { side: "left", text: "Bet", children: text("Promise", "Differentiation", "Non-goals") },
      { side: "left", text: "Evidence", children: text("What we know", "What we'll test", "Signals") },
    ],
  },
  {
    id: "business-plan",
    title: "Business planning",
    description: "Sketch the offer, market, operations, and money.",
    root: "Business plan",
    branches: [
      { side: "right", text: "Offer", children: text("Who pays", "Pricing", "Delivery") },
      { side: "right", text: "Market", children: text("Demand", "Channels", "Competition") },
      { side: "left", text: "Operations", children: text("People", "Tools", "Risks") },
      { side: "left", text: "Money", children: text("Revenue", "Costs", "Runway") },
    ],
  },
  {
    id: "project-plan",
    title: "Project planning",
    description: "Define the outcome, the work, the risks, and the cadence.",
    root: "Project",
    branches: [
      { side: "right", text: "Outcome", children: text("Done looks like", "Out of scope", "Deadline") },
      { side: "right", text: "Workstreams", children: text("Design", "Build", "Launch") },
      { side: "left", text: "Risks", children: text("Dependencies", "Unknowns", "Mitigations") },
      { side: "left", text: "Cadence", children: text("Milestones", "Owners", "Check-ins") },
    ],
  },
  {
    id: "architecture",
    title: "Software architecture",
    description: "Map clients, services, data, and the qualities that matter.",
    root: "System",
    branches: [
      { side: "right", text: "Clients", children: text("Web app", "API consumers", "Admin") },
      { side: "right", text: "Services", children: text("Auth", "Documents", "Realtime") },
      { side: "left", text: "Data", children: text("Postgres", "Object storage", "Cache") },
      { side: "left", text: "Qualities", children: text("Latency", "Privacy", "Failure") },
    ],
  },
  {
    id: "meeting-notes",
    title: "Meeting notes",
    description: "Keep context, discussion, decisions, and actions in one map.",
    root: "Meeting",
    branches: [
      { side: "right", text: "Context", children: text("Goal", "Attendees", "Timebox") },
      { side: "right", text: "Discussion", children: text("Update", "Question", "Decision") },
      { side: "left", text: "Actions", children: text("Owner", "Task", "Due") },
      { side: "left", text: "Still open", children: text("Parking lot", "Follow-up", "Risk") },
    ],
  },
  {
    id: "customer-journey",
    title: "Customer journeys",
    description: "Follow a customer from discovery through expansion.",
    root: "Journey",
    branches: [
      { side: "right", text: "Discover", children: text("Trigger", "Channel", "First impression") },
      { side: "right", text: "Evaluate", children: text("Questions", "Proof", "Friction") },
      { side: "left", text: "Adopt", children: text("Setup", "First value", "Habit") },
      { side: "left", text: "Expand", children: text("Success", "Referral", "Renewal") },
    ],
  },
  {
    id: "learning-plan",
    title: "Learning plans",
    description: "Turn a skill into foundations, practice, and review.",
    root: "Learning goal",
    branches: [
      { side: "right", text: "Outcome", children: text("Skill", "Evidence", "Deadline") },
      { side: "right", text: "Foundations", children: text("Concepts", "Vocabulary", "Resources") },
      { side: "left", text: "Practice", children: text("Exercises", "Project", "Feedback") },
      { side: "left", text: "Review", children: text("Gaps", "Schedule", "Next level") },
    ],
  },
  {
    id: "marketing",
    title: "Marketing campaigns",
    description: "Align the audience, story, channels, and measurement.",
    root: "Campaign",
    branches: [
      { side: "right", text: "Audience", children: text("Segment", "Insight", "Offer") },
      { side: "right", text: "Story", children: text("Message", "Proof", "Call to action") },
      { side: "left", text: "Channels", children: text("Owned", "Earned", "Paid") },
      { side: "left", text: "Measure", children: text("Goal", "Metric", "Readout") },
    ],
  },
  {
    id: "organization",
    title: "Organizational structures",
    description: "Show how leadership, product, market, and platform fit together.",
    root: "Organization",
    branches: [
      { side: "right", text: "Leadership", children: text("Direction", "Staff", "Cadence") },
      { side: "right", text: "Product", children: text("Discovery", "Delivery", "Design") },
      { side: "left", text: "Go to market", children: text("Marketing", "Sales", "Success") },
      { side: "left", text: "Platform", children: text("Engineering", "Operations", "Finance") },
    ],
  },
  {
    id: "sample-product-plan",
    title: "Sample product plan",
    description: "Test data for import, reparent, translate, and collapse.",
    root: "Product Plan",
    branches: [
      {
        side: "right",
        text: "Audience",
        children: [
          { text: "Weekly digest" },
          { text: "Channels", children: text("Newsletter", "Social posts") },
          { text: "Personas", children: text("Founders", "Product managers", "Design leads") },
        ],
      },
      {
        side: "right",
        text: "Timeline",
        children: text("June beta", "July feedback", "August launch"),
      },
      {
        side: "left",
        text: "Risks",
        children: text("Research delays", "Hiring blockers", "Vendor slip"),
      },
    ],
  },
];

function text(...labels: string[]): TemplateBranch[] {
  return labels.map((label) => ({ text: label }));
}

export interface TemplateSummary {
  id: string;
  title: string;
  description: string;
}

export function listTemplates(): TemplateSummary[] {
  return TEMPLATES.map(({ id, title, description }) => ({ id, title, description }));
}

export function createTemplateDocument(id: string, ctx: ApplyContext = {}): MindMapDocument | null {
  const template = TEMPLATES.find((item) => item.id === id);
  if (!template) return null;
  return buildTemplate(template, ctx);
}

export function createWelcomeDocument(ctx: ApplyContext = {}): MindMapDocument {
  return buildTemplate(
    {
      id: "welcome",
      title: "Welcome to Arbour",
      description: "A short tour of the editor.",
      root: "Arbour",
      branches: [
        {
          side: "right",
          text: "Map a thought",
          children: [
            { text: "Tab adds a child" },
            { text: "Enter adds a sibling" },
            { text: "Double-click to rename" },
          ],
        },
        {
          side: "right",
          text: "Arrange the branch",
          children: [
            { text: "Drag onto a topic to reparent" },
            { text: "Option-drag to duplicate" },
            { text: "Tidy layout from the toolbar" },
          ],
        },
        {
          side: "left",
          text: "Make it yours",
          children: [
            { text: "Color, shape, and type" },
            { text: "Notes and cross-links", nodeType: "note" },
            { text: "Ten starter templates" },
          ],
        },
        {
          side: "left",
          text: "Stays on this device",
          children: [
            { text: "Saved in this browser" },
            { text: "Export SVG, PNG, or JSON" },
            { text: "Undo with ⌘Z" },
          ],
        },
      ],
    },
    ctx,
  );
}

function buildTemplate(template: TemplateDefinition, ctx: ApplyContext): MindMapDocument {
  let doc = createDocument({
    title: template.title,
    rootText: template.root,
    createId: ctx.createId,
    now: ctx.now?.(),
  });
  for (const branch of template.branches) {
    doc = addBranch(doc, doc.rootId, branch, branch.side, ctx);
  }
  return doc;
}

function addBranch(
  doc: MindMapDocument,
  parentId: string,
  branch: TemplateBranch,
  side: Side | undefined,
  ctx: ApplyContext,
): MindMapDocument {
  const added = applyCommand(
    doc,
    {
      type: "addChild",
      parentId,
      text: branch.text,
      nodeType: branch.nodeType,
      side,
    },
    ctx,
  );
  let next = added.document;
  const id = added.focusId;
  if (!id) return next;
  for (const child of branch.children ?? []) {
    next = addBranch(next, id, child, undefined, ctx);
  }
  return next;
}
