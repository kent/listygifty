"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Gift, Users, Ban, List } from "lucide-react";

interface ExchangeNavProps {
  exchangeId: number;
  isOwner: boolean;
}

export function ExchangeNav({ exchangeId, isOwner }: ExchangeNavProps) {
  const pathname = usePathname();
  const basePath = `/exchanges/${exchangeId}`;

  const navItems = [
    {
      href: basePath,
      label: "Overview",
      icon: Gift,
      exact: true,
    },
    ...(isOwner
      ? [
          {
            href: `${basePath}/participants`,
            label: "Participants",
            icon: Users,
            exact: false,
          },
          {
            href: `${basePath}/exclusions`,
            label: "Exclusions",
            icon: Ban,
            exact: false,
          },
        ]
      : []),
    {
      href: `${basePath}/my-wishlist`,
      label: "My Wishlist",
      icon: List,
      exact: false,
    },
  ];

  return (
    <nav className="flex gap-1 mb-6 overflow-x-auto pb-2">
      {navItems.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
              isActive
                ? "bg-violet-500/20 text-violet-700 dark:text-violet-400"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
