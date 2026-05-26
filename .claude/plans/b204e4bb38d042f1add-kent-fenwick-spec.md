# Add Kent Fenwick to the Footer — Spec

**Ticket:** b204e4bb — Add Kent Fenwick to the footer

## Goal

Surface Kent Fenwick's name in the shared site footer that renders on every page of the web app, keeping the existing `ewakened.com` link intact.

## Scope

- **In scope:** The shared footer component `apps/web/src/components/layout/Footer.tsx`, which is mounted globally in `apps/web/src/app/layout.tsx:140`.
- **Out of scope:** The inline page-specific footers in `apps/web/src/app/giving-pledge/page.tsx:114` and `apps/web/src/app/email-preferences/[token]/page.tsx:207`. These are bespoke marketing/standalone footers and are not what users mean when they say "the footer." Leave them alone unless the ticket is later clarified.

## Current State

`apps/web/src/components/layout/Footer.tsx` is a single anchor:

```tsx
export function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-white/10 py-6 text-center text-sm text-slate-500 dark:text-muted-foreground">
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
```

## Proposed Change

Add "Kent Fenwick" as the author, with the existing `ewakened.com` link reused as the link target (ewakened.com is Kent's site).

Target output (rendered):

```
Made by Kent Fenwick · ewakened.com
```

Updated component:

```tsx
export function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-white/10 py-6 text-center text-sm text-slate-500 dark:text-muted-foreground">
      <span>Made by </span>
      <a
        href="https://ewakened.com"
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
```

If the reviewer prefers a single link, collapse to:

```tsx
<a href="https://ewakened.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700 dark:hover:text-slate-200">
  Made by Kent Fenwick — ewakened.com
</a>
```

Default to the two-link version above; flag the single-link option in the PR description so the reviewer can pick.

## Open Questions

1. Should "Kent Fenwick" link to `https://ewakened.com`, or to a different URL (e.g., personal site, LinkedIn)? Default: ewakened.com.
2. Phrasing — "Made by", "Built by", or "by"? Default: "Made by".

If no answer at implementation time, ship the defaults and call them out in the PR description.

## Files

- **Modify:** `apps/web/src/components/layout/Footer.tsx` — only file touched.

## Verification

- [ ] `npm run lint` (workspace lint) passes.
- [ ] `npm run typecheck` (or workspace equivalent) passes.
- [ ] Start the web dev server (`npm run dev -w apps/web` or the repo's standard) and visually confirm the footer reads "Made by Kent Fenwick · ewakened.com" on any page (e.g. `/`).
- [ ] Confirm both light and dark mode render legibly (the existing classes cover both).
- [ ] Confirm the link(s) open `https://ewakened.com` in a new tab.

No automated tests exist for this component and one is not warranted for a static-string change.

## Commit

Single commit, conventional-commits style:

```
feat(web): credit Kent Fenwick in site footer
```
