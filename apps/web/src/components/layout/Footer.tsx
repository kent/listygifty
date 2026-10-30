import Link from "next/link";
import { PixelSprite } from "@/components/retro/PixelSprite";
import { ThemeSwitcher } from "@/components/theme-switcher";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/business/signup", label: "Business" },
  { href: "/integrations", label: "Integrations" },
  { href: "/support", label: "Support" },
  { href: "/privacy-policy", label: "Privacy" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <>
      <footer className="theme-festive-only retro-hud mt-8">
        <div className="container mx-auto flex flex-col items-center gap-3 px-4 py-4 lg:flex-row lg:justify-between">
          <div className="flex items-center gap-2">
            <PixelSprite name="gift" scale={2} />
            <span className="font-display text-[10px] text-amber-300">LISTY GIFTY</span>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-1.5">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="retro-hud-panel px-3 py-1 text-sm text-white hover:bg-violet-500"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <span className="font-mono text-lg text-violet-200">© {year}</span>
          </div>
        </div>
      </footer>

      <footer className="theme-apple-only mt-16 border-t border-black/5 bg-slate-100/60">
        <div className="container mx-auto flex flex-col items-center gap-4 px-4 py-6 text-sm text-slate-600 dark:text-slate-500 md:flex-row md:justify-between">
          <span>© {year} Listy Gifty</span>
          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-slate-900">
                {link.label}
              </Link>
            ))}
          </nav>
          <ThemeSwitcher />
        </div>
      </footer>
    </>
  );
}
