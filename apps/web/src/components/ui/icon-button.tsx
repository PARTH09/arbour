"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={350} skipDelayDuration={200}>
      {children}
    </Tooltip.Provider>
  );
}

export function IconButton({
  label,
  shortcut,
  active,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  shortcut?: string;
  active?: boolean;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink transition-colors hover:bg-accent-soft disabled:hover:bg-transparent",
            active && "bg-accent text-white hover:bg-accent",
            className,
          )}
          {...props}
        >
          {children}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={8}
          className="z-50 flex items-center gap-2 rounded-lg bg-ink px-2 py-1 text-xs text-panel shadow-lg"
        >
          {label}
          {shortcut ? <span className="text-[10px] text-white/70">{shortcut}</span> : null}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
