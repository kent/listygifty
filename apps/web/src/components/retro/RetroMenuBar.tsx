"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export interface RetroMenuItem {
  label: string;
  href: string;
  /** Function key number shown on the tab and bound as a shortcut (F1, F2...). */
  fkey: number;
  active?: boolean;
}

interface RetroMenuBarProps {
  items: readonly RetroMenuItem[];
  /** Rendered on the far right of the bar. */
  right?: ReactNode;
  className?: string;
}

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Binds F-keys to menu items (ignored while typing or with modifier keys). */
export function useFunctionKeys(items: readonly Pick<RetroMenuItem, "href" | "fkey">[]) {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const match = /^F(\d+)$/.exec(event.key);
      if (!match) return;
      const item = items.find((i) => i.fkey === Number(match[1]));
      if (!item) return;
      event.preventDefault();
      if (item.href.startsWith("#")) {
        document.querySelector(item.href)?.scrollIntoView({ behavior: "smooth" });
      } else {
        router.push(item.href);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [items, router]);
}

/**
 * The "Help F1 | File F2 | Options F3" strip from early-90s DOS games.
 * Function keys really do work as shortcuts.
 */
export function RetroMenuBar({ items, right, className }: RetroMenuBarProps) {
  useFunctionKeys(items);

  return (
    <div
      className={cn(
        "flex items-stretch gap-0 border-b-2 border-slate-900 bg-white text-slate-900",
        className
      )}
    >
      <nav aria-label="Main menu" className="scrollbar-none flex min-w-0 flex-1 items-stretch overflow-x-auto">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "group relative -mr-px flex shrink-0 items-center gap-3 border-r-2 border-slate-900 py-1 pl-2 pr-5 font-display text-[10px] uppercase leading-none transition-colors sm:gap-6 sm:text-xs",
              "[clip-path:polygon(0_0,calc(100%-10px)_0,100%_100%,0_100%)]",
              item.active ? "bg-slate-900 text-white" : "bg-white hover:bg-violet-700 hover:text-white"
            )}
          >
            <span className="normal-case">{item.label}</span>
            <span className={cn("hidden sm:inline", item.active ? "text-amber-300" : "text-slate-500 group-hover:text-amber-300")}>
              F{item.fkey}
            </span>
          </Link>
        ))}
      </nav>
      {right && <div className="flex shrink-0 items-center gap-2 px-2">{right}</div>}
    </div>
  );
}
