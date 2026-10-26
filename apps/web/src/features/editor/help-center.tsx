"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  BookOpen,
  FileUp,
  FolderKanban,
  Keyboard,
  Languages,
  LayoutTemplate,
  MousePointer2,
  Puzzle,
  Search,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  HELP_SECTIONS,
  searchHelp,
  type HelpArticle,
  type HelpBlock,
  type HelpSection,
  type HelpSectionId,
} from "@/features/editor/help-content";
import { SHORTCUTS } from "@/features/editor/shortcuts";
import { useEditor } from "@/features/editor/store";

const SECTION_ICONS: Record<HelpSectionId, ReactNode> = {
  start: <Sparkles size={22} />,
  tools: <MousePointer2 size={22} />,
  editing: <Puzzle size={22} />,
  layout: <LayoutTemplate size={22} />,
  import: <FileUp size={22} />,
  translate: <Languages size={22} />,
  share: <Share2 size={22} />,
  shortcuts: <Keyboard size={22} />,
  faq: <BookOpen size={22} />,
};

type View =
  | { kind: "home" }
  | { kind: "section"; sectionId: HelpSectionId }
  | { kind: "article"; sectionId: HelpSectionId; articleId: string };

export function HelpCenter() {
  const open = useEditor((state) => state.helpOpen);
  const helpSection = useEditor((state) => state.helpSection);
  const setHelpOpen = useEditor((state) => state.setHelpOpen);
  const [query, setQuery] = useState("");
  const [articleId, setArticleId] = useState<string | null>(null);

  const sectionId =
    helpSection && HELP_SECTIONS.some((section) => section.id === helpSection)
      ? (helpSection as HelpSectionId)
      : null;
  const view: View = sectionId
    ? articleId
      ? { kind: "article", sectionId, articleId }
      : { kind: "section", sectionId }
    : { kind: "home" };

  const hits = useMemo(() => searchHelp(query), [query]);
  const activeSection = sectionId ? HELP_SECTIONS.find((section) => section.id === sectionId) ?? null : null;
  const activeArticle =
    view.kind === "article" && activeSection
      ? activeSection.articles.find((article) => article.id === view.articleId) ?? null
      : null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery("");
          setArticleId(null);
        }
        setHelpOpen(next, next ? helpSection : null);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px]" />
        <Dialog.Content
          className="fixed inset-3 z-50 flex flex-col overflow-hidden rounded-3xl border border-line bg-panel text-ink shadow-2xl outline-none sm:inset-6 md:inset-y-8 md:inset-x-[max(1.5rem,calc(50%-28rem))]"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Learn Arbour</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search help articles and browse categories for how to use Arbour.
          </Dialog.Description>

          <header className="relative shrink-0 overflow-hidden border-b border-line px-5 pt-5 pb-6 sm:px-8 sm:pt-7 sm:pb-8">
            <div
              className="pointer-events-none absolute inset-0 opacity-90"
              style={{
                background:
                  "radial-gradient(ellipse 80% 70% at 10% 0%, color-mix(in oklab, var(--arbour-accent) 22%, transparent), transparent 55%), radial-gradient(ellipse 60% 50% at 90% 10%, color-mix(in oklab, var(--arbour-accent) 12%, transparent), transparent 50%)",
              }}
            />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium tracking-wide text-accent uppercase">Learn Arbour</p>
                <h2 className="mt-1 font-display text-2xl font-medium tracking-tight sm:text-3xl">How can we help?</h2>
                <p className="mt-1.5 max-w-xl text-sm text-muted">
                  Get answers, learn the tools, and move faster on the canvas.
                </p>
              </div>
              <Dialog.Close
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-panel/80 text-muted hover:bg-accent-soft hover:text-ink"
                aria-label="Close help"
              >
                <X size={16} />
              </Dialog.Close>
            </div>
            <label className="relative mt-5 flex h-11 items-center gap-2 rounded-2xl border border-line bg-panel px-3 shadow-sm">
              <Search size={16} className="shrink-0 text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search help (e.g. translate, import, shortcuts)"
                aria-label="Search help articles"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
              />
              <kbd className="hidden rounded-md bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-muted sm:inline">?</kbd>
            </label>
          </header>

          <div className="min-h-0 flex-1 overflow-auto px-5 py-5 sm:px-8 sm:py-6">
            {query.trim() ? (
              <SearchResults
                hits={hits}
                onOpen={(section, article) => {
                  setQuery("");
                  setArticleId(article.id);
                  setHelpOpen(true, section.id);
                }}
              />
            ) : view.kind === "home" ? (
              <CategoryGrid
                onOpen={(nextSection) => {
                  setArticleId(null);
                  setHelpOpen(true, nextSection);
                }}
              />
            ) : view.kind === "section" && activeSection ? (
              <SectionView
                section={activeSection}
                onBack={() => {
                  setArticleId(null);
                  setHelpOpen(true, null);
                }}
                onOpenArticle={(nextArticle) => setArticleId(nextArticle)}
              />
            ) : view.kind === "article" && activeSection && activeArticle ? (
              <ArticleView
                section={activeSection}
                article={activeArticle}
                onBack={() => setArticleId(null)}
              />
            ) : (
              <CategoryGrid
                onOpen={(nextSection) => {
                  setArticleId(null);
                  setHelpOpen(true, nextSection);
                }}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CategoryGrid({ onOpen }: { onOpen: (id: HelpSectionId) => void }) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <FolderKanban size={16} className="text-accent" />
        <h3 className="text-sm font-medium">All categories</h3>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {HELP_SECTIONS.map((section) => (
          <li key={section.id}>
            <button
              type="button"
              onClick={() => onOpen(section.id)}
              className="group flex h-full w-full gap-3 rounded-2xl border border-line bg-canvas/50 p-4 text-left transition hover:border-accent/40 hover:bg-accent-soft/60"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-panel text-accent shadow-sm ring-1 ring-line group-hover:ring-accent/30">
                {SECTION_ICONS[section.id]}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{section.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">{section.blurb}</span>
                <span className="mt-2 block text-[11px] text-muted">
                  {section.articles.length} {section.articles.length === 1 ? "article" : "articles"}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionView({
  section,
  onBack,
  onOpenArticle,
}: {
  section: HelpSection;
  onBack: () => void;
  onOpenArticle: (articleId: string) => void;
}) {
  return (
    <div>
      <BackButton label="All categories" onClick={onBack} />
      <div className="mt-4 flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          {SECTION_ICONS[section.id]}
        </span>
        <div>
          <h3 className="font-display text-xl font-medium">{section.label}</h3>
          <p className="mt-1 text-sm text-muted">{section.intro}</p>
        </div>
      </div>
      <ul className="mt-5 space-y-2">
        {section.articles.map((article) => (
          <li key={article.id}>
            <button
              type="button"
              onClick={() => onOpenArticle(article.id)}
              className="flex w-full flex-col gap-1 rounded-xl border border-line bg-panel px-4 py-3 text-left transition hover:border-accent/35 hover:bg-accent-soft/50"
            >
              <span className="text-sm font-medium">{article.title}</span>
              <span className="text-xs leading-relaxed text-muted">{article.summary}</span>
            </button>
          </li>
        ))}
      </ul>
      {section.id === "shortcuts" ? (
        <ul className="mt-6 space-y-1 rounded-2xl border border-line bg-canvas/40 p-3">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.keys} className="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 text-sm">
              <span>{shortcut.label}</span>
              <kbd className="rounded-md bg-panel px-1.5 py-0.5 font-mono text-[11px] text-muted">{shortcut.keys}</kbd>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ArticleView({
  section,
  article,
  onBack,
}: {
  section: HelpSection;
  article: HelpArticle;
  onBack: () => void;
}) {
  return (
    <article className="mx-auto max-w-2xl">
      <BackButton label={section.label} onClick={onBack} />
      <p className="mt-4 text-xs font-medium tracking-wide text-accent uppercase">{section.label}</p>
      <h3 className="mt-1 font-display text-2xl font-medium tracking-tight sm:text-[1.75rem]">{article.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{article.summary}</p>
      <div className="mt-8 space-y-6 border-t border-line pt-6">
        {article.blocks.map((block, index) => (
          <ArticleBlock key={`${article.id}-${index}`} block={block} />
        ))}
      </div>
    </article>
  );
}

function ArticleBlock({ block }: { block: HelpBlock }) {
  if (block.type === "paragraph") {
    return <p className="text-sm leading-7 text-ink/90">{block.text}</p>;
  }
  if (block.type === "heading") {
    return <h4 className="font-display text-base font-medium tracking-tight text-ink">{block.text}</h4>;
  }
  if (block.type === "steps") {
    return (
      <div>
        {block.title ? <h4 className="mb-2.5 text-sm font-medium text-ink">{block.title}</h4> : null}
        <ol className="space-y-2.5">
          {block.items.map((item, index) => (
            <li key={item} className="flex gap-3 text-sm leading-6 text-ink/90">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
                {index + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  if (block.type === "bullets") {
    return (
      <div>
        {block.title ? <h4 className="mb-2.5 text-sm font-medium text-ink">{block.title}</h4> : null}
        <ul className="space-y-2">
          {block.items.map((item) => (
            <li key={item} className="flex gap-2.5 text-sm leading-6 text-ink/90">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const tone =
    block.tone === "warning"
      ? "border-danger/25 bg-danger/5 text-ink"
      : block.tone === "tip"
        ? "border-accent/25 bg-accent-soft/70 text-ink"
        : "border-line bg-canvas/70 text-ink";
  const label = block.tone === "warning" ? "Important" : block.tone === "tip" ? "Tip" : "Note";
  return (
    <aside className={cn("rounded-2xl border px-4 py-3", tone)}>
      <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 text-sm leading-6">{block.text}</p>
    </aside>
  );
}

function SearchResults({
  hits,
  onOpen,
}: {
  hits: { section: HelpSection; article: HelpArticle }[];
  onOpen: (section: HelpSection, article: HelpArticle) => void;
}) {
  if (!hits.length) {
    return <p className="py-10 text-center text-sm text-muted">No articles match that search.</p>;
  }
  return (
    <ul className="space-y-2">
      {hits.map(({ section, article }) => (
        <li key={`${section.id}-${article.id}`}>
          <button
            type="button"
            onClick={() => onOpen(section, article)}
            className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-left transition hover:border-accent/35 hover:bg-accent-soft/50"
          >
            <span className="block text-[11px] text-muted">{section.label}</span>
            <span className="mt-0.5 block text-sm font-medium">{article.title}</span>
            <span className="mt-1 line-clamp-2 block text-xs text-muted">{article.summary}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm text-muted hover:bg-accent-soft hover:text-ink")}
    >
      <ArrowLeft size={14} />
      {label}
    </button>
  );
}
