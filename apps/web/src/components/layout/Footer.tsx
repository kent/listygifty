export function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-white/10 py-6 text-center text-sm text-slate-500 dark:text-muted-foreground">
      <span>Built by </span>
      <a
        href="https://kentfenwick.com"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-slate-700 dark:hover:text-slate-200"
      >
        Kent Fenwick
      </a>
      <span aria-hidden="true"> · </span>
      <a
        href="https://ewakened.com"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-slate-700 dark:hover:text-slate-200"
      >
        ewakened.com
      </a>
    </footer>
  );
}
