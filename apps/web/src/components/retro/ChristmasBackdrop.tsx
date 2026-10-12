import { PixelSprite } from "./PixelSprite";
import { Snowfall } from "./RetroScene";

const TREES = [
  { left: "2%", scale: 9 },
  { left: "9%", scale: 6 },
  { left: "15%", scale: 7 },
  { left: "71%", scale: 6 },
  { left: "86%", scale: 10 },
  { left: "94%", scale: 7 },
];

/** Deterministic pseudo-random so server and client agree. */
function rand(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const STARS = Array.from({ length: 28 }, (_, i) => ({
  left: rand(i) * 100,
  top: rand(i + 50) * 55,
  size: rand(i + 100) > 0.75 ? 3 : 2,
  duration: 2 + rand(i + 150) * 4,
  delay: -rand(i + 200) * 6,
}));

function SmokePuff({ delay }: { delay: number }) {
  return (
    <span
      className="retro-smoke absolute bottom-full left-1 h-2 w-2 bg-[#8a84c4]"
      style={{ animationDelay: `${delay}s` }}
    />
  );
}

/**
 * A night-time Christmas scene fixed behind the whole app. It stays quiet so
 * content reads easily, but there's always something happening: twinkling
 * stars, the odd shooting star, chimney smoke, snow, and every so often
 * Santa's sleigh crosses the sky with Rudolph out front.
 */
export function ChristmasBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Twinkling stars */}
      {STARS.map((s, i) => (
        <span
          key={i}
          className="retro-twinkle absolute bg-white"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}

      {/* Shooting star */}
      <span className="retro-shooting-star absolute left-[60%] top-[8%] h-[2px] w-16 bg-gradient-to-r from-transparent to-white" />

      {/* Moon */}
      <div className="absolute right-[10%] top-[14%] h-14 w-14 rounded-full bg-[#ece9c8] opacity-25 shadow-[0_0_0_10px_rgb(236_233_200_/_0.05),0_0_0_22px_rgb(236_233_200_/_0.03)]">
        <span className="absolute left-3 top-4 h-2 w-2 rounded-full bg-[#cfcba4]" />
        <span className="absolute right-3 top-7 h-3 w-3 rounded-full bg-[#cfcba4]" />
      </div>

      {/* Santa's sleigh and Rudolph */}
      <div className="retro-sleigh absolute left-0 top-[18%]">
        <div className="retro-bob flex items-end gap-1 opacity-70">
          <PixelSprite name="sleigh" scale={3} />
          <span className="mb-6 h-px w-8 bg-amber-300/70" />
          <PixelSprite name="reindeer" scale={3} />
          <span className="mb-6 h-px w-4 bg-amber-300/70" />
          <div className="relative">
            <PixelSprite name="reindeer" scale={3} />
            {/* Rudolph's nose */}
            <span className="retro-nose absolute right-0 top-[9px] h-[3px] w-[3px] rounded-full bg-red-400" />
          </div>
        </div>
      </div>

      <div className="opacity-50">
        <Snowfall />
      </div>

      {/* Far and near hills */}
      <div className="absolute inset-x-0 bottom-0 h-[30vh] bg-[#14104e] [clip-path:polygon(0_45%,10%_25%,22%_40%,35%_18%,50%_38%,63%_20%,78%_42%,90%_22%,100%_35%,100%_100%,0_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[16vh] bg-[#1a165c] [clip-path:polygon(0_40%,15%_20%,32%_45%,48%_25%,66%_45%,82%_15%,100%_40%,100%_100%,0_100%)]" />

      {/* Pines along the ridge, lights gently pulsing */}
      <div className="absolute inset-x-0 bottom-[6vh]">
        {TREES.map((t, i) => (
          <div
            key={i}
            className="retro-tree-glow absolute bottom-0 opacity-20"
            style={{ left: t.left, animationDelay: `${-i * 0.7}s` }}
          >
            <PixelSprite name="tree" scale={t.scale} />
          </div>
        ))}
      </div>

      {/* A far-off cabin with warm windows and a smoking chimney */}
      <div className="absolute bottom-[9vh] left-[78%] hidden opacity-50 md:block">
        <div className="relative h-10 w-16 bg-[#0f0c40]">
          <div className="absolute -top-3 -left-1 -right-1 h-3 bg-[#2a2670]" />
          <div className="absolute -top-7 right-3 h-5 w-3 bg-[#2a2670]">
            <SmokePuff delay={0} />
            <SmokePuff delay={1.3} />
            <SmokePuff delay={2.6} />
          </div>
          <div className="retro-window-flicker absolute left-2 top-3 h-3 w-3 bg-amber-300/80" />
          <div className="absolute right-2 top-3 h-3 w-3 bg-amber-300/80" />
        </div>
      </div>
    </div>
  );
}
