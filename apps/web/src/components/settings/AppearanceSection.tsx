"use client";

import { Palette } from "lucide-react";
import { ThemeCards } from "@/components/theme-switcher";

/** One-click theme picker. Themes live in src/lib/themes.ts. */
export function AppearanceSection() {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
          <Palette className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Appearance</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Pick a theme. It applies instantly and is remembered on this device.
          </p>
        </div>
      </div>
      <ThemeCards />
    </section>
  );
}
