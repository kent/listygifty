import { Metadata } from "next";
import Link from "next/link";
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
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-4"
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
      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-6">
        <Link
          href="/"
          className="flex items-center gap-3 border-[3px] border-black bg-[#0b0838] px-4 py-2 shadow-[6px_6px_0_0_rgb(110_106_168_/_0.85)]"
        >
          <PixelSprite name="gift" scale={3} />
          <span className="font-display text-base text-amber-300 [text-shadow:2px_2px_0_#a00a10]">
            LISTY GIFTY
          </span>
        </Link>
        {children}
      </div>
    </div>
  );
}
