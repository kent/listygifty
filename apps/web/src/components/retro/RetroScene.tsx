import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PixelSprite, type SpriteName } from "./PixelSprite";

/** Deterministic pseudo-random so server and client render the same snow. */
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const FLAKES = Array.from({ length: 36 }, (_, i) => ({
  left: rand(i) * 100,
  size: rand(i + 100) > 0.7 ? 4 : 2,
  duration: 6 + rand(i + 200) * 8,
  delay: -rand(i + 300) * 14,
}));

export function Snowfall({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {FLAKES.map((f, i) => (
        <div
          key={i}
          className="retro-snowfall absolute top-0 h-full"
          style={{
            left: `${f.left}%`,
            animation: `retro-snow ${f.duration}s steps(40) ${f.delay}s infinite`,
          }}
        >
          <div className="bg-white" style={{ width: f.size, height: f.size }} />
        </div>
      ))}
    </div>
  );
}

/** A round, warmly lit window like the one on the MathStorm cabin. */
function CabinWindow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative h-16 w-16 overflow-hidden rounded-full border-4 border-[#7a4a1e] bg-amber-300 shadow-[0_0_0_3px_#fff] sm:h-24 sm:w-24",
        className
      )}
    >
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 bg-[#7a4a1e]" />
      <div className="absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 bg-[#7a4a1e]" />
      <div className="absolute inset-x-2 top-2 h-2 bg-amber-100/70" />
    </div>
  );
}

interface RetroSceneProps {
  bubble?: ReactNode;
  className?: string;
}

/**
 * A snowy, lavender night scene in the style of Treasure MathStorm:
 * a wooden sign, a cabin, a tree, a snowman, and a pile of presents.
 */
export function RetroScene({ bubble, className }: RetroSceneProps) {
  const presents: { name: SpriteName; left: string; bottom: string; scale: number }[] = [
    { name: "gift", left: "56%", bottom: "14%", scale: 5 },
    { name: "treasure", left: "63%", bottom: "13%", scale: 4 },
    { name: "gift", left: "59%", bottom: "26%", scale: 3 },
  ];

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{
        // Banded, 16-colour style sky
        background:
          "linear-gradient(#5b4fa8 0 18%, #6d61b8 18% 34%, #8277c6 34% 48%, #988fd3 48% 60%, #aea6de 60% 70%, #c9c4e2 70%)",
      }}
    >
      <Snowfall />

      {/* Distant hills */}
      <div aria-hidden className="absolute inset-x-0 bottom-[22%] h-[18%] bg-[#d9d5ee] [clip-path:polygon(0_60%,12%_20%,26%_55%,40%_15%,58%_50%,72%_10%,88%_45%,100%_25%,100%_100%,0_100%)]" />

      {/* Cabin wall */}
      <div aria-hidden className="absolute bottom-[18%] right-[4%] hidden h-[62%] w-[30%] border-4 border-slate-900 bg-[#8277c6] md:block">
        <div className="absolute -top-5 -left-3 -right-3 h-6 rounded-full bg-white shadow-[0_3px_0_#c9c4e2]" />
        <div className="absolute left-[12%] top-[22%]">
          <CabinWindow />
        </div>
        <div className="absolute bottom-0 right-[14%] h-[62%] w-[30%] border-4 border-b-0 border-slate-900 bg-[#9a5a24]">
          <div className="absolute right-2 top-1/2 h-2 w-2 bg-amber-300" />
        </div>
      </div>

      {/* Snow ground */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[24%] bg-[#e9e7f7]">
        <div className="absolute inset-x-0 top-0 h-2 bg-white" />
        <div className="absolute left-[30%] top-[40%] flex gap-3 opacity-60">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="block h-1 w-2 bg-[#aaa4cf]" />
          ))}
        </div>
      </div>

      {/* The wooden sign */}
      <div className="absolute bottom-[18%] left-[4%] flex flex-col items-center">
        <div className="border-4 border-[#4a2a10] bg-[#9a5a24] px-3 py-2 shadow-[4px_4px_0_#15114a] sm:px-4 sm:py-3">
          <span className="font-display text-[10px] text-amber-300 [text-shadow:2px_2px_0_#4a2a10] sm:text-sm">
            LISTY GIFTY
          </span>
        </div>
        <div className="h-10 w-2 bg-[#4a2a10] sm:h-20" />
      </div>

      {/* Tree, snowman and presents */}
      <div className="absolute bottom-[14%] left-[24%] sm:left-[28%]">
        <PixelSprite name="tree" scale={7} className="sm:hidden" />
        <PixelSprite name="tree" scale={11} className="hidden sm:inline-block" />
      </div>
      <div className="absolute bottom-[14%] left-[48%] hidden sm:block">
        <PixelSprite name="snowman" scale={6} />
      </div>
      {presents.map((p, i) => (
        <div key={i} className="absolute hidden sm:block" style={{ left: p.left, bottom: p.bottom }}>
          <PixelSprite name={p.name} scale={p.scale} />
        </div>
      ))}

      {bubble && (
        <div className="absolute right-[4%] top-[8%] max-w-[55%] md:right-[36%] md:max-w-[34%]">
          <div className="relative rounded-[40%] border-4 border-slate-900 bg-white px-5 py-3 text-center shadow-[4px_4px_0_#15114a]">
            {bubble}
            <span aria-hidden className="absolute -bottom-4 left-1/2 h-5 w-5 rotate-45 border-b-4 border-r-4 border-slate-900 bg-white" />
          </div>
        </div>
      )}
    </div>
  );
}
