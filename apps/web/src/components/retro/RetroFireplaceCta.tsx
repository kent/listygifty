import { AUTH_ROUTES } from "@/services";
import { TrackedLink } from "@/components/tracked-link";
import { PixelSprite } from "./PixelSprite";

// The stocking sprite is red; hue-rotate gives us the blue, magenta and green ones.
const STOCKINGS = [
  { hue: "hue-rotate(235deg)", label: "Blue stocking" },
  { hue: "hue-rotate(300deg)", label: "Magenta stocking" },
  { hue: "hue-rotate(120deg)", label: "Green stocking" },
];

const BRICKS =
  "repeating-linear-gradient(0deg, #4a0a0a 0 2px, transparent 2px 18px), " +
  "repeating-linear-gradient(90deg, #4a0a0a 0 2px, transparent 2px 36px), #a01818";

/** A cosy EGA-style fireplace scene that closes out the landing page. */
export function RetroFireplaceCta() {
  return (
    <section className="container mx-auto px-4 py-20">
      <div className="retro-window mx-auto max-w-5xl overflow-hidden">
        <div className="retro-titlebar">FIREPLC.EXE</div>
        <div className="relative bg-[#0b0838] px-4 pt-10 text-center md:px-10">
          <h2 className="font-display text-lg leading-relaxed text-amber-300 [text-shadow:3px_3px_0_#a00a10] md:text-3xl">
            Ready to make gifting effortless?
          </h2>
          <p className="mx-auto mt-4 max-w-xl font-mono text-2xl text-violet-100">
            Start your 2026 gift plan now, then keep adding ideas whenever they happen.
          </p>
          <div className="mt-8 flex flex-col items-center gap-2">
            <TrackedLink
              href={AUTH_ROUTES.signUp}
              analyticsEvent="homepage_cta_clicked"
              analyticsProperties={{ location: "final_cta", destination: "signup" }}
              className="retro-key px-6 py-2 text-lg"
            >
              Press Enter <span className="text-white">to start free</span>
            </TrackedLink>
            <span className="font-mono text-lg text-violet-300">
              No credit card required<span className="retro-blink">_</span>
            </span>
          </div>

          {/* The hearth */}
          <div className="relative mx-auto mt-12 flex max-w-3xl items-end justify-center gap-4">
            <div className="hidden pb-2 sm:block">
              <PixelSprite name="tree" scale={9} title="Christmas tree" />
            </div>

            <div className="relative w-full max-w-md">
              {/* Mantel with candles */}
              <div className="flex items-end justify-between px-6">
                <PixelSprite name="candle" scale={4} />
                <PixelSprite name="candle" scale={4} />
              </div>
              <div className="h-4 border-2 border-[#4a2a10] bg-[#c87a2a]" />

              <div className="relative h-56 border-x-2 border-[#4a0a0a]" style={{ background: BRICKS }}>
                {/* Stockings hanging from the mantel */}
                <div className="absolute inset-x-0 top-0 z-10 flex justify-center gap-6">
                  {STOCKINGS.map((s) => (
                    <div key={s.label} style={{ filter: s.hue }}>
                      <PixelSprite name="stocking" scale={5} title={s.label} />
                    </div>
                  ))}
                </div>

                {/* Firebox */}
                <div className="absolute inset-x-10 bottom-0 top-10 border-4 border-b-0 border-[#ff8080] bg-black sm:inset-x-16">
                  <div className="absolute inset-x-0 bottom-2 flex justify-center">
                    <div className="retro-flicker">
                      <PixelSprite name="fire" scale={7} title="A crackling fire" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="h-3 bg-[#c8141c]" />
            </div>

            <div className="hidden pb-3 sm:block">
              <PixelSprite name="gift" scale={4} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
