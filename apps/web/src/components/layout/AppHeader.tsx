"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@niftygifty/types";
import { ArrowLeftRight, Calendar, Crown, Home, Settings, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";
import { PixelSprite, useFunctionKeys } from "@/components/retro";

interface AppHeaderProps {
  user: User | null;
  onSignOut: () => void;
}

// F5 is left alone so refresh still works.
const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", fkey: 1, icon: Home },
  { href: "/holidays", label: "Gift Lists", fkey: 2, icon: Calendar },
  { href: "/exchanges", label: "Exchanges", fkey: 3, icon: ArrowLeftRight },
  { href: "/people", label: "People", fkey: 4, icon: Users },
  { href: "/settings", label: "Options", fkey: 6, icon: Settings },
] as const;

// A raised blue key on the HUD; the active page becomes a red key.
const KEY_BASE =
  "group flex shrink-0 items-center gap-2 border-2 px-3 py-1.5 text-sm font-semibold leading-none transition-colors active:translate-y-px";
const KEY_IDLE =
  "border-t-violet-400 border-l-violet-400 border-r-black border-b-black bg-violet-700 text-white hover:bg-violet-600";
const KEY_ACTIVE =
  "border-t-red-300 border-l-red-300 border-r-red-900 border-b-red-900 bg-red-600 text-amber-200 [text-shadow:1px_1px_0_#500305]";

export function AppHeader({ user, onSignOut }: AppHeaderProps) {
  const pathname = usePathname();
  const { isPremium, billingStatus } = useAuth();
  useFunctionKeys(NAV_ITEMS);

  const items = useMemo(
    () =>
      NAV_ITEMS.map((item) => ({
        ...item,
        active: pathname === item.href || pathname.startsWith(`${item.href}/`),
      })),
    [pathname]
  );

  return (
    <header className="retro-hud relative z-10 !border-b-4 !border-b-black">
      <div className="container mx-auto px-4">
        {/* Logo, workspace and account */}
        <div className="flex flex-wrap items-center justify-between gap-3 py-2">
          <div className="flex min-w-0 items-center gap-3 md:gap-5">
            <Link href="/dashboard" className="flex items-center gap-2" aria-label="Listy Gifty home">
              <PixelSprite name="gift" scale={3} />
              <span className="font-display text-[11px] text-amber-300 [text-shadow:2px_2px_0_#a00a10] md:text-sm">
                LISTY GIFTY
              </span>
            </Link>
            <div className="min-w-0 [&_button]:!h-8 [&_button]:!py-0 [&_button]:border-2 [&_button]:border-t-white [&_button]:border-l-white [&_button]:border-r-black [&_button]:border-b-black [&_button]:!bg-[#c3c3c3] [&_button]:!text-[#0b0838] [&_button:hover]:!bg-[#d4d4d4] [&_button_svg]:!text-[#0b0838] [&_button_svg]:!opacity-100">
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
              <span className="hidden max-w-[240px] truncate font-mono text-xl text-violet-100 lg:inline">
                {user.email}
              </span>
            )}
            <button type="button" onClick={onSignOut} className="retro-key text-sm">
              Sign out
            </button>
          </div>
        </div>

        {/* Main menu: chunky keys with their F-key shortcut */}
        <nav aria-label="Main menu" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-2.5 pt-1">
          {items.map(({ href, label, fkey, icon: Icon, active }) => (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(KEY_BASE, active ? KEY_ACTIVE : KEY_IDLE)}
            >
              <Icon className="h-4 w-4" />
              {label}
              <span
                className={cn(
                  "ml-1 hidden border px-1 py-0.5 font-mono text-base leading-none sm:inline",
                  active ? "border-amber-200/60 text-amber-200" : "border-violet-300/50 text-amber-300"
                )}
              >
                F{fkey}
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
