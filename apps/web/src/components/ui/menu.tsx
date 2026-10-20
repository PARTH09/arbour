"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({
  className,
  ...props
}: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={8}
        align="end"
        className={cn(
          "z-50 min-w-52 rounded-xl border border-line bg-panel p-1 text-sm text-ink shadow-lg",
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

export function MenuItem({ className, ...props }: ComponentProps<typeof DropdownMenu.Item>) {
  return (
    <DropdownMenu.Item
      className={cn(
        "flex cursor-pointer items-center justify-between gap-4 rounded-lg px-2.5 py-1.5 outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-accent-soft",
        className,
      )}
      {...props}
    />
  );
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenu.Label>) {
  return (
    <DropdownMenu.Label
      className={cn("px-2.5 py-1 text-[11px] font-medium tracking-wide text-muted uppercase", className)}
      {...props}
    />
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-line" />;
}

export function MenuSub({ children }: { children: ReactNode }) {
  return <DropdownMenu.Sub>{children}</DropdownMenu.Sub>;
}

export function MenuSubTrigger({ className, ...props }: ComponentProps<typeof DropdownMenu.SubTrigger>) {
  return (
    <DropdownMenu.SubTrigger
      className={cn(
        "flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 outline-none data-[highlighted]:bg-accent-soft data-[state=open]:bg-accent-soft",
        className,
      )}
      {...props}
    />
  );
}

export function MenuSubContent({ className, ...props }: ComponentProps<typeof DropdownMenu.SubContent>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.SubContent
        sideOffset={8}
        className={cn(
          "z-50 min-w-44 rounded-xl border border-line bg-panel p-1 text-sm text-ink shadow-lg",
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}
