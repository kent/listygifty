import Link from "next/link";
import { ChevronRight, Gift } from "lucide-react";
import { AUTH_ROUTES } from "@/services";
import { TrackedLink } from "@/components/tracked-link";
import { HeroPreview } from "@/components/hero-preview";

/** Apple theme landing hero: big type, lots of air, one blue call to action. */
export function AppleLandingHero() {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/75 backdrop-blur-xl backdrop-saturate-150">
        <nav className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <Gift className="h-4 w-4 text-white" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-slate-900">Listy Gifty</span>
          </Link>
          <div className="flex items-center gap-5 text-sm">
            <Link href="#features" className="hidden text-slate-600 hover:text-slate-900 sm:inline">
              Features
            </Link>
            <Link href="/business/signup" className="hidden text-slate-600 hover:text-slate-900 sm:inline">
              Business
            </Link>
            <Link href={AUTH_ROUTES.signIn} className="text-slate-600 hover:text-slate-900">
              Sign in
            </Link>
            <TrackedLink
              href={AUTH_ROUTES.signUp}
              analyticsEvent="homepage_cta_clicked"
              analyticsProperties={{ location: "header", destination: "signup" }}
              className="rounded-full bg-violet-600 px-3.5 py-1.5 font-medium text-white transition-colors hover:bg-violet-500"
            >
              Get started
            </TrackedLink>
          </div>
        </nav>
      </header>

      <section className="container mx-auto px-4 pb-16 pt-20 text-center md:pt-28">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-violet-600">Gift planning</p>
        <h1 className="mx-auto max-w-4xl text-5xl font-semibold tracking-tight text-slate-900 md:text-7xl">
          Never stress about gifts again.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-xl leading-relaxed text-slate-500 md:text-2xl">
          Capture ideas when they happen, organize every person and occasion, and run gift exchanges
          without the group chat and the spreadsheet.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <TrackedLink
            href={AUTH_ROUTES.signUp}
            analyticsEvent="homepage_cta_clicked"
            analyticsProperties={{ location: "hero", destination: "signup" }}
            className="rounded-full bg-violet-600 px-7 py-3 text-lg font-medium text-white transition-colors hover:bg-violet-500"
          >
            Start planning for free
          </TrackedLink>
          <a href="#features" className="flex items-center text-lg text-link hover:underline">
            See how it works
            <ChevronRight className="h-5 w-5" />
          </a>
        </div>

        <div className="mx-auto mt-20 max-w-4xl rounded-[28px] border border-black/5 bg-slate-900 p-4 shadow-2xl md:p-8">
          <HeroPreview />
        </div>
        <p className="mt-6 text-sm text-slate-500">Built for Christmas 2026. Families, exchanges and teams welcome.</p>
      </section>
    </>
  );
}

/** Apple theme closing call to action. */
export function AppleCta() {
  return (
    <section className="container mx-auto px-4 py-24 text-center">
      <h2 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
        Ready to make gifting effortless?
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-xl text-slate-500">
        Start your 2026 gift plan now, then keep adding ideas whenever they happen.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3">
        <TrackedLink
          href={AUTH_ROUTES.signUp}
          analyticsEvent="homepage_cta_clicked"
          analyticsProperties={{ location: "final_cta", destination: "signup" }}
          className="rounded-full bg-violet-600 px-7 py-3 text-lg font-medium text-white transition-colors hover:bg-violet-500"
        >
          Get started free
        </TrackedLink>
        <span className="text-sm text-slate-500">No credit card required.</span>
      </div>
    </section>
  );
}
