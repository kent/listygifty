"use client";

import { Monitor } from "lucide-react";

const SPECS = [
  { label: "Colors", value: "16 (VGA)" },
  { label: "Resolution", value: "640 x 480" },
  { label: "Font", value: "Pixel Sans" },
  { label: "Snow", value: "On" },
];

/**
 * The retro build has a single look, so instead of a light/dark picker this
 * shows a little "Display Properties" panel for fun.
 */
export function AppearanceSection() {
  return (
    <section className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="retro-raised flex h-10 w-10 items-center justify-center">
          <Monitor className="h-5 w-5 text-slate-900" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Appearance</h2>
          <p className="text-sm text-slate-600">Listy Gifty is running in Retro &apos;96 mode.</p>
        </div>
      </div>

      <div className="retro-window max-w-xl">
        <div className="retro-titlebar">Display Properties</div>
        <div className="grid gap-6 p-6 sm:grid-cols-[160px_1fr]">
          <div className="retro-sunken bg-slate-900 p-2">
            <div className="flex aspect-[4/3] flex-col bg-violet-700">
              <div className="h-2 bg-gradient-to-r from-violet-900 to-violet-400" />
              <div className="flex flex-1 items-center justify-center">
                <span className="font-display text-[8px] text-amber-300">LISTY GIFTY</span>
              </div>
              <div className="h-3 bg-red-600" />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-lg text-slate-900">
            {SPECS.map(({ label, value }) => (
              <div key={label} className="contents">
                <dt className="text-slate-600">{label}:</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
