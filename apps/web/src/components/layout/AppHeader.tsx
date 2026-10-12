"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@niftygifty/types";
import { Crown, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";
import { PixelSprite, RetroMenuBar } from "@/components/retro";

interface AppHeaderProps {
  user: User | null;
  onSignOut: () => void;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", fkey: 1 },
  { href: "/holidays", label: "Gift Lists", fkey: 2 },
  { href: "/exchanges", label: "Exchanges", fkey: 3 },
  { href: "/people", label: "People", fkey: 4 },
  { href: "/settings", label: "Options", fkey: 6 },
] as const;

export function AppHeader({ user, onSignOut }: AppHeaderProps) {
  const pathname = usePathname();
  const { isPremium, billingStatus } = useAuth();

  const items = NAV_ITEMS.map((item) => ({
    ...item,
    active: pathname === item.href || pathname.startsWith(`${item.href}/`),
  }));

  return (
    <header className="relative z-10 border-b-4 border-slate-900">
      <RetroMenuBar items={items} />

      <div className="retro-hud">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-2">
          <div className="flex min-w-0 items-center gap-3 md:gap-6">
            <Link href="/dashboard" className="flex items-center gap-2" aria-label="Listy Gifty home">
              <PixelSprite name="gift" scale={3} />
              <span className="font-display text-[11px] text-amber-300 [text-shadow:2px_2px_0_#03053d] md:text-sm">
                LISTY GIFTY
              </span>
            </Link>
            <div className="min-w-0 [&_button]:!py-1 [&_button]:border-2 [&_button]:border-t-white [&_button]:border-l-white [&_button]:border-r-slate-900 [&_button]:border-b-slate-900 [&_button]:bg-[#c3c3c3] [&_button]:text-slate-900">
              <WorkspaceSwitcher />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isPremium ? (
              <Link
                href="/billing"
                className="retro-hud-panel flex items-center gap-1.5 px-2 py-1 text-sm text-amber-300"
              >
                <Crown className="h-4 w-4" />
                <span className="hidden sm:inline">Premium</span>
              </Link>
            ) : billingStatus ? (
              <Link href="/billing" className="retro-key text-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Upgrade
              </Link>
            ) : null}
            {user && (
              <span className="hidden max-w-[220px] truncate font-mono text-lg text-violet-100 lg:inline">
                {user.email}
              </span>
            )}
            <button type="button" onClick={onSignOut} className="retro-key text-sm">
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
