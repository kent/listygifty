# Contributing

Thanks for thinking about contributing to Listy Gifty. This is
primarily a single-author product, but PRs that fix bugs, improve docs, or
add clearly scoped features are welcome.

## Getting set up

See `README.md` for the local dev story. Short version:

```bash
npm install
npm run build
# Terminal 1
cd apps/api && bin/rails server -p 3001
# Terminal 2
cd apps/web && npm run dev
# Terminal 3 (optional, separate dep tree)
cd apps/mobile && npm install --legacy-peer-deps && npx expo start
```

## Working on a change

1. Branch off `main` (`feat/your-change` or `fix/your-bug`).
2. Keep changes small and focused — one concern per PR.
3. Run the relevant tests before pushing:
   - `cd apps/api && bin/rails test`
   - `cd apps/mobile && npm test -- --runInBand`
   - `npm run build` (web + shared packages)
4. Add or update tests for new behaviour.
5. Open a PR describing the *why* — what user-visible problem this solves
   or what risk it reduces.

## Code style

- TypeScript everywhere except the Rails API.
- Shared types live in `packages/types`; never duplicate.
- Service-layer pattern: components use shared services from `packages/services`
  rather than calling the API directly.
- Run `cd apps/web && npm run lint` and `cd apps/api && bin/rubocop` before opening a PR.

## Areas where help is appreciated

- Accessibility passes on the web app
- Mobile app polish (Expo SDK / React Native idioms)
- More test coverage on the Rails API (especially edge cases on the
  gift-exchange matching algorithm)
- Documentation improvements

## What to avoid

- Don't add features speculatively; tie new code to a concrete user need.
- Don't break the public API (the Rails API contract) without coordination.
- Don't commit credentials, even in `.env` files; the repo is public.
- Avoid large refactors without discussion — open an issue first.

## License

By contributing, you agree your contributions are licensed under the MIT
License (see `LICENSE`).
