import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PixelSprite, type SpriteName } from "./PixelSprite";

export interface HudStat {
  label: string;
  value: ReactNode;
  sprite: SpriteName;
}

interface RetroHudProps {
  /** Left-hand panel, usually a cluster of red pill keys. */
  keys?: ReactNode;
  stats: HudStat[];
  className?: string;
}

/** The deep blue inventory bar along the bottom of a MathStorm screen. */
export function RetroHud({ keys, stats, className }: RetroHudProps) {
  return (
    <div className={cn("retro-hud grid gap-1 p-1.5 sm:grid-flow-col sm:auto-cols-fr", className)}>
      {keys && (
        <div className="retro-hud-panel flex flex-wrap items-center justify-center gap-1.5 p-2 sm:col-span-2">
          {keys}
        </div>
      )}
      <div className="grid grid-cols-4 gap-1 sm:contents">
        {stats.map((stat) => (
          <div key={stat.label} className="retro-hud-panel flex flex-col items-center justify-between gap-1 px-1 py-1.5 text-center">
            <span className="text-xs leading-none sm:text-sm">{stat.label}</span>
            <PixelSprite name={stat.sprite} scale={3} />
            <span className="font-mono text-xl leading-none text-amber-300">{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
