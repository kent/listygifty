"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_THEMES, DEFAULT_THEME, type AppThemeId } from "@/lib/themes";

const emptySubscribe = () => () => {};
function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

/** The active theme id (the default until mounted, to keep hydration stable). */
export function useAppTheme() {
  const { theme, setTheme } = useTheme();
  const mounted = useIsMounted();
  const current = (mounted && theme ? theme : DEFAULT_THEME) as AppThemeId;
  return { theme: current, setTheme: (id: AppThemeId) => setTheme(id) };
}

/** Compact one-click toggle, e.g. in the footer. */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useAppTheme();

  return (
    <div role="radiogroup" aria-label="Theme" className={cn("theme-switcher inline-flex items-center gap-1 p-1", className)}>
      {APP_THEMES.map((t) => {
        const active = theme === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(t.id)}
            className="theme-switcher-option flex items-center gap-1.5 px-3 py-1 text-sm font-medium"
            data-active={active || undefined}
          >
            <span className="flex -space-x-1" aria-hidden>
              {t.swatches.slice(1, 4).map((color) => (
                <span key={color} className="h-2.5 w-2.5 rounded-full ring-1 ring-black/20" style={{ background: color }} />
              ))}
            </span>
            {t.name}
          </button>
        );
      })}
    </div>
  );
}

/** Large preview cards for Settings: click one to apply it. */
export function ThemeCards() {
  const { theme, setTheme } = useAppTheme();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {APP_THEMES.map((t) => {
        const active = theme === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTheme(t.id)}
            aria-pressed={active}
            className={cn(
              "theme-card group relative flex flex-col overflow-hidden rounded-xl border text-left transition",
              active ? "border-primary ring-2 ring-primary" : "border-border hover:border-slate-400"
            )}
          >
            {/* Mini preview */}
            <div className="flex h-28 flex-col" style={{ background: t.swatches[0] }}>
              <div className="h-3" style={{ background: t.id === "festive" ? t.swatches[1] : "rgb(255 255 255 / 0.8)" }} />
              <div className="flex flex-1 items-center gap-3 px-4">
                <div
                  className="h-12 flex-1 rounded-md"
                  style={{
                    background: t.id === "festive" ? "#110d48" : "#ffffff",
                    boxShadow: t.id === "festive" ? "3px 3px 0 #4a4590" : "0 4px 12px rgb(0 0 0 / 0.08)",
                    borderRadius: t.id === "festive" ? 2 : 12,
                  }}
                >
                  <div className="m-2 h-2 w-1/2 rounded-sm" style={{ background: t.swatches[3] }} />
                  <div className="mx-2 h-1.5 w-3/4 rounded-sm opacity-50" style={{ background: t.swatches[2] }} />
                </div>
                <div
                  className="h-7 w-16"
                  style={{
                    background: t.id === "festive" ? t.swatches[2] : t.swatches[3],
                    borderRadius: t.id === "festive" ? 2 : 999,
                  }}
                />
              </div>
            </div>
            <div className="flex items-start justify-between gap-3 bg-card p-4">
              <div>
                <div className="font-semibold text-foreground">{t.name}</div>
                <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
              </div>
              {active && (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
