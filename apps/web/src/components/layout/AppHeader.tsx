"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@niftygifty/types";
import { ArrowLeftRight, Calendar, Crown, Gift, Home, ListTodo, Settings, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";
import { PixelSprite, useFunctionKeys } from "@/components/retro";

interface AppHeaderProps {
  user: User | null;
  onSignOut: () => void;
}

// F5 (refresh) and F7 (caret browsing) are left to the browser.
const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", fkey: 1, icon: Home },
  { href: "/holidays", label: "Gift Lists", fkey: 2, icon: Calendar },
  { href: "/wishlists", label: "Wishlists", fkey: 8, icon: ListTodo },
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

const EDGE_FADE = "1.75rem";

type NavItem = (typeof NAV_ITEMS)[number] & { active: boolean };

interface HeaderViewProps extends AppHeaderProps {
  items: NavItem[];
  isPremium: boolean;
  showUpgrade: boolean;
}

/** Renders the header for every theme; CSS shows the one for the active theme. */
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
  const view = { user, onSignOut, items, isPremium, showUpgrade: !isPremium && !!billingStatus };

  return (
    <>
      <FestiveHeader {...view} />
      <AppleHeader {...view} />
    </>
  );
}

/** Main menu row: keeps the current page in view and fades any edge with more items past it. */
function ScrollingNav({ className, children }: { className: string; children: ReactNode }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const [moreLeft, setMoreLeft] = useState(false);
  const [moreRight, setMoreRight] = useState(false);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      setMoreLeft(nav.scrollLeft > 1);
      setMoreRight(nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1);
    };

    // Sets scrollLeft directly so the page itself never scrolls.
    const current = nav.querySelector('[aria-current="page"]');
    if (current && nav.scrollWidth > nav.clientWidth) {
      const navBox = nav.getBoundingClientRect();
      const itemBox = current.getBoundingClientRect();
      nav.scrollLeft += itemBox.left + itemBox.width / 2 - (navBox.left + navBox.width / 2);
    }

    measure();
    nav.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      nav.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [pathname]);

  // A mask fades the items themselves, so it suits both themes' header backgrounds.
  const mask =
    moreLeft || moreRight
      ? `linear-gradient(to right, transparent, black ${moreLeft ? EDGE_FADE : "0px"}, black calc(100% - ${moreRight ? EDGE_FADE : "0px"}), transparent)`
      : undefined;

  return (
    <nav ref={navRef} aria-label="Main menu" className={className} style={{ maskImage: mask, WebkitMaskImage: mask }}>
      {children}
    </nav>
  );
}

function AppleHeader({ user, onSignOut, items, isPremium, showUpgrade }: HeaderViewProps) {
  return (
    <header className="theme-apple-only sticky top-0 z-20 border-b border-black/5 bg-white/75 backdrop-blur-xl backdrop-saturate-150">
      <div className="container mx-auto flex h-14 items-center gap-6 px-4">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2" aria-label="Listy Gifty home">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
            <Gift className="h-4 w-4 text-white" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-slate-900">Listy Gifty</span>
        </Link>

        <ScrollingNav className="scrollbar-none hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex">
          {items.map(({ href, label, active }) => (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors",
                active ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:text-slate-900"
              )}
            >
              {label}
            </Link>
          ))}
        </ScrollingNav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden lg:block">
            <WorkspaceSwitcher />
          </div>
          {isPremium ? (
            <Link href="/billing" className="flex items-center gap-1 text-sm font-medium text-amber-800 dark:text-amber-600">
              <Crown className="h-4 w-4" />
              <span className="hidden sm:inline">Premium</span>
            </Link>
          ) : showUpgrade ? (
            <Link
              href="/billing"
              className="rounded-full bg-violet-600 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
            >
              Upgrade
            </Link>
          ) : null}
          {user && <span className="hidden max-w-[200px] truncate text-sm text-slate-600 dark:text-slate-500 xl:inline">{user.email}</span>}
          <button type="button" onClick={onSignOut} className="text-sm text-slate-600 transition-colors hover:text-slate-900">
            Sign out
          </button>
        </div>
      </div>

      {/* Mobile menu row */}
      <ScrollingNav className="scrollbar-none flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
        {items.map(({ href, label, active }) => (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm",
              active ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600"
            )}
          >
            {label}
          </Link>
        ))}
      </ScrollingNav>
    </header>
  );
}

function FestiveHeader({ user, onSignOut, items, isPremium, showUpgrade }: HeaderViewProps) {

  return (
    <header className="theme-festive-only retro-hud relative z-10 !border-b-4 !border-b-black">
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
            ) : showUpgrade ? (
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
        <ScrollingNav className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-2.5 pt-1">
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
        </ScrollingNav>
      </div>
    </header>
  );
}
