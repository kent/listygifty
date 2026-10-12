import Link from "next/link";
import { AUTH_ROUTES } from "@/services";
import { TrackedLink } from "@/components/tracked-link";
import { HeroPreview } from "@/components/hero-preview";
import { PixelSprite, type SpriteName } from "./PixelSprite";
import { RetroMenuBar } from "./RetroMenuBar";
import { RetroScene } from "./RetroScene";
import { RetroHud } from "./RetroHud";

const MENU_ITEMS = [
  { label: "Features", href: "#features", fkey: 1 },
  { label: "Business", href: "/business/signup", fkey: 2 },
  { label: "AI Helpers", href: "#ai-integrations", fkey: 3 },
  { label: "Sign in", href: AUTH_ROUTES.signIn, fkey: 4 },
];

const HOME_SCREEN_ITEMS: { sprite: SpriteName; title: string; blurb: string; href: string }[] = [
  { sprite: "gift", title: "Make a List", blurb: "Track every gift by person", href: "#features" },
  { sprite: "star", title: "Capture Ideas", blurb: "Save them the moment they happen", href: "#features" },
  { sprite: "bag", title: "Set a Budget", blurb: "Know what's planned, bought, wrapped", href: "#features" },
  { sprite: "people", title: "Draw Names", blurb: "Run a Secret Santa without the group chat", href: "#features" },
  { sprite: "calendar", title: "Every Occasion", blurb: "Birthdays, Diwali, Eid, anniversaries", href: "#occasions" },
  { sprite: "robot", title: "Ask a Robot", blurb: "Claude, ChatGPT and any MCP client", href: "#ai-integrations" },
  { sprite: "treasure", title: "For Business", blurb: "Employee gifting, imports, exports", href: "/business/signup" },
];

export function RetroLandingHero() {
  return (
    <>
      {/* The "game screen": menu bar, snow scene, inventory HUD */}
      <section className="container mx-auto px-4 pt-6 md:pt-10">
        <div className="retro-window mx-auto max-w-6xl overflow-hidden">
          <RetroMenuBar
            items={MENU_ITEMS}
            right={
              <TrackedLink
                href={AUTH_ROUTES.signUp}
                analyticsEvent="homepage_cta_clicked"
                analyticsProperties={{ location: "header", destination: "signup" }}
                className="retro-key my-0.5 text-xs"
              >
                Start
              </TrackedLink>
            }
          />
          <RetroScene
            className="aspect-[4/3] sm:aspect-[16/8]"
            bubble={
              <>
                <p className="font-display text-[10px] leading-relaxed text-fuchsia-600 sm:text-base">
                  How many gifts?
                </p>
                <p className="mt-1 hidden font-mono text-lg leading-tight text-slate-700 sm:block">
                  Let Listy Gifty keep count this year.
                </p>
              </>
            }
          />
          <RetroHud
            keys={
              <>
                <TrackedLink
                  href={AUTH_ROUTES.signUp}
                  analyticsEvent="homepage_cta_clicked"
                  analyticsProperties={{ location: "hero", destination: "signup" }}
                  className="retro-key"
                >
                  Enter <span className="text-white">Start free</span>
                </TrackedLink>
                <a href="#features" className="retro-key">
                  F1 <span className="text-white">Tour</span>
                </a>
                <Link href={AUTH_ROUTES.signIn} className="retro-key">
                  F4 <span className="text-white">Sign in</span>
                </Link>
              </>
            }
            stats={[
              { label: "Gifts", value: 27, sprite: "gift" },
              { label: "Budget", value: "$250", sprite: "bag" },
              { label: "Lists", value: 9, sprite: "calendar" },
              { label: "Swaps", value: 3, sprite: "treasure" },
            ]}
          />
        </div>
      </section>

      {/* Encarta '96 style home screen */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="retro-window mx-auto max-w-6xl">
          <div className="retro-titlebar">
            <PixelSprite name="gift" scale={1} />
            Listy Gifty 96 Gift Encyclopedia
          </div>
          <div
            className="relative grid gap-10 overflow-hidden p-6 md:grid-cols-[1.1fr_1fr] md:p-10"
            style={{
              background:
                "radial-gradient(circle at 20% 30%, #ffffff 0, #eef0ff 40%, #dde1ff 100%)",
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -left-4 top-16 select-none font-serif text-[11rem] font-bold leading-none text-violet-200/70 md:left-24 md:top-10 md:text-[16rem]"
            >
              96
            </span>

            <div className="relative flex flex-col">
              <p className="retro-spaced mb-6 text-[10px] text-slate-600">Home Screen</p>
              <p className="font-serif text-5xl font-bold tracking-tight text-violet-900 md:text-7xl">
                LISTY GIFTY
              </p>
              <h1 className="mt-2 font-serif text-xl italic tracking-[0.2em] text-slate-600 md:text-2xl">
                Never stress about gifts again
              </h1>
              <p className="mt-8 max-w-md text-lg leading-relaxed text-slate-800">
                Capture gift ideas when they happen, organize every recipient and occasion, and
                run gift exchanges without a group thread plus a spreadsheet.
              </p>

              <div className="mt-auto flex flex-col gap-3 pt-10 sm:flex-row">
                <a
                  href="#features"
                  className="retro-spaced border-2 border-slate-700 bg-white/60 px-4 py-2 text-center text-[11px] text-slate-800 hover:bg-white"
                >
                  Introduction
                </a>
                <TrackedLink
                  href={AUTH_ROUTES.signUp}
                  analyticsEvent="homepage_cta_clicked"
                  analyticsProperties={{ location: "home_screen", destination: "signup" }}
                  className="retro-spaced border-2 border-slate-700 bg-white/60 px-4 py-2 text-center text-[11px] text-slate-800 hover:bg-white"
                >
                  Sign up free
                </TrackedLink>
              </div>
            </div>

            <nav aria-label="Explore Listy Gifty" className="relative">
              <ul className="space-y-4">
                {HOME_SCREEN_ITEMS.map((item) => (
                  <li key={item.title}>
                    <Link href={item.href} className="group flex items-center gap-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center transition-transform group-hover:-translate-y-0.5">
                        <PixelSprite name={item.sprite} scale={3} />
                      </span>
                      <span>
                        <span className="retro-spaced block text-[10px] text-slate-900 group-hover:text-red-600 md:text-xs">
                          {item.title}
                        </span>
                        <span className="block text-sm text-slate-600 group-hover:text-red-600">
                          {item.blurb}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </section>

      {/* Live demo inside a little window */}
      <section className="container mx-auto px-4 pb-16">
        <div className="retro-window mx-auto max-w-4xl">
          <div className="retro-titlebar">See it in action</div>
          <div className="bg-slate-900 p-4 md:p-8">
            <HeroPreview />
          </div>
        </div>
        <p className="mt-6 text-center font-mono text-xl text-slate-600">
          <span className="retro-blink text-red-600">&#9658;</span> Built for Christmas 2026 planning.
          Families, exchanges, and teams welcome.
        </p>
      </section>
    </>
  );
}
