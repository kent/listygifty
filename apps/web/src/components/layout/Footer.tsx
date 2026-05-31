import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500 dark:border-white/10 dark:text-muted-foreground">
      <nav aria-label="Footer" className="mb-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <Link href="/" className="hover:text-slate-700 dark:hover:text-slate-200">
          Home
        </Link>
        <Link href="/business/signup" className="hover:text-slate-700 dark:hover:text-slate-200">
          Business
        </Link>
        <Link href="/integrations" className="hover:text-slate-700 dark:hover:text-slate-200">
          Integrations
        </Link>
        <Link href="/support" className="hover:text-slate-700 dark:hover:text-slate-200">
          Support
        </Link>
        <Link href="/privacy-policy" className="hover:text-slate-700 dark:hover:text-slate-200">
          Privacy
        </Link>
      </nav>
      <span>© 2026 Listy Gifty</span>
    </footer>
  );
}
