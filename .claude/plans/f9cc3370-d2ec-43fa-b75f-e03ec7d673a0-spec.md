# Footer · append "made on the canvas"

## Current footer state
`apps/web/src/components/layout/Footer.tsx` renders a single `<footer>` containing one `<a>` linking to `ewakened.com` (text "ewakened.com"). Note: the ticket describes the rendered footer as `© 2026 · Crafted by Kent Fenwick · ewakened.com`, but the source currently only renders the `ewakened.com` link — we'll still follow the ticket's structural instruction and append the two spans as new trailing children of the `<footer>` element, immediately after the existing `<a>`.

## Exact JSX changes
Insert two new siblings after the closing `</a>` and before `</footer>`:

```tsx
        ewakened.com
      </a>
      <span aria-hidden="true"> · </span>
      <span>made on the canvas</span>
    </footer>
```

No other lines change. The existing `<a>` (href, target, rel, className, text) and the `<footer>` wrapper (className) are preserved verbatim.

## Verification
After deploy to production:

```bash
curl -s https://listygifty.com | grep -o "made on the canvas"
```

Expect: at least one match of `made on the canvas`. Also visually confirm the trailing ` · made on the canvas` appears after the `ewakened.com` link in the rendered footer.
