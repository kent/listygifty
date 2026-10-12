import { Metadata } from "next";
import Link from "next/link";
import { Gift } from "lucide-react";
import { PixelSprite, Snowfall } from "@/components/retro";

// Force dynamic rendering for auth pages to avoid Clerk SSG issues
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
    googleBot: {
      index: false,
      follow: true,
    },
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Festive: snowy MathStorm-style sky behind the sign-in window */}
      <div
        aria-hidden
        className="theme-festive-only absolute inset-0"
        style={{
          background:
            "linear-gradient(#5b4fa8 0 18%, #6d61b8 18% 34%, #8277c6 34% 48%, #988fd3 48% 60%, #aea6de 60% 72%, #e9e7f7 72%)",
        }}
      >
        <Snowfall />
        <div className="absolute bottom-[10%] left-[6%] hidden md:block">
          <PixelSprite name="tree" scale={10} />
        </div>
        <div className="absolute bottom-[10%] right-[8%] hidden md:block">
          <PixelSprite name="snowman" scale={7} />
        </div>
      </div>
      {/* Apple: a soft, bright wash */}
      <div
        aria-hidden
        className="theme-apple-only absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#e0edff_0%,_#fbfbfd_55%)]"
      />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-6">
        <Link
          href="/"
          className="theme-festive-only flex items-center gap-3 border-[3px] border-black bg-[#0b0838] px-4 py-2 shadow-[6px_6px_0_0_rgb(110_106_168_/_0.85)]"
        >
          <PixelSprite name="gift" scale={3} />
          <span className="font-display text-base text-amber-300 [text-shadow:2px_2px_0_#a00a10]">
            LISTY GIFTY
          </span>
        </Link>
        <Link href="/" className="theme-apple-only flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
            <Gift className="h-4 w-4 text-white" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-slate-900">Listy Gifty</span>
        </Link>
        {children}
      </div>
    </div>
  );
}
