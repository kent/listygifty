# Listy Gifty Mobile App Guidelines

## Overview
`apps/mobile` is the Expo/React Native client for Listy Gifty.
It shares types and services with the monorepo but has its own dependency graph and build/test flow.

## Critical Build Constraint

The mobile app is intentionally decoupled from root npm workspaces.

Why:
- React Native uses React `19.1.x`
- Web uses React `19.2.x`
- workspace hoisting can break React Native resolution

Rules:
1. Install dependencies from `apps/mobile` only.
2. Keep `apps/mobile/package-lock.json` independent.
3. Keep shared package imports via `file:` dependencies in `apps/mobile/package.json`.

## Current Structure

```text
apps/mobile/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── auth/
│   ├── join/
│   └── (tabs)/
│       ├── lists/
│       ├── exchanges/
│       ├── people/
│       └── profile/
├── components/
├── lib/
├── __tests__/
└── package.json
```

## DRY and Clean Code Rules (Required)

1. Do not duplicate formatting/status/UI-state logic across screens.
2. Reuse shared modules first:
   - `lib/formatters.ts`
   - `lib/gift-status-colors.ts`
   - `lib/linking.ts`
   - `components/ScreenLoader.tsx`
   - `components/InlineError.tsx`
   - `components/FloatingActionButton.tsx`
3. Keep network calls in services (`@niftygifty/services` + `lib/api.ts`), not directly in UI components.
4. Keep screens focused on orchestration; move reusable logic to `lib/*` or reusable components.
5. When touching behavior, update or add tests in `__tests__/`.

## Shared Package Usage

Always prefer shared monorepo packages:
- `@niftygifty/types`
- `@niftygifty/api-client`
- `@niftygifty/services`

Before mobile development when shared packages changed:

```bash
cd /path/to/listygifty
npm run build
```

## Commands

Install:

```bash
cd apps/mobile
npm install --legacy-peer-deps
```

Run:

```bash
npx expo start
npx expo start --ios
npx expo start --android
```

Quality checks:

```bash
npm test -- --runInBand
npx tsc --noEmit
```

## TestFlight Releases

When a user asks for a Listy Gifty TestFlight release:
- Treat `deploy to TestFlight`, `ship to TestFlight`, `release to TestFlight`,
  `test flight`, and obvious misspellings such as `deploy to test lfihgt` as
  explicit authorization for a new production TestFlight build. The user does
  not need to know or mention `/testflight`, EAS, GitHub Actions, credentials,
  or a profile.
- Do not queue a build when the user is only asking to configure, document, or
  verify the release automation.
- Use the App Store Connect internal testing group `Internal Testers`.
- Treat `kent.fenwick@gmail.com` as an internal tester for that group.
- Use the production iOS EAS submit path unless the user explicitly asks for a different profile or group.
- Do not default production TestFlight releases to `Staging`.
- Keep Expo and Apple release credentials in GitHub Actions, never in Cursor
  Cloud secrets or repository files.
- Complete the normal pull request checks and merge without bypassing branch
  protection. Wait for any relevant production deploy for the exact merge SHA,
  then comment exactly `/testflight` on the merged pull request. If there is no
  suitable merged pull request for the current `main` commit, manually dispatch
  `Mobile Release` from `main` with the production TestFlight options.
- Monitor the workflow through build, submit, Apple processing, and attachment
  to `Internal Testers`, then report the verified build number and links.
- Use a manual `main` run of the `Deploy` workflow with its mobile input enabled
  when the backend and TestFlight build need to run as one serialized recovery
  release.
- See `docs/mobile-release.md` for the complete Cursor Mobile flow.

## Feature Workflow

1. Confirm or add shared types in `packages/types`.
2. Confirm or add service methods in `packages/services`.
3. Implement screen/component changes in `apps/mobile`.
4. Reuse existing shared mobile helpers/components before adding new ones.
5. Run tests and type-check.

## Environment Variables

`apps/mobile/.env`:

```bash
EXPO_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```


## Troubleshooting

Reset Metro cache:

```bash
npx expo start --clear
```

Reinstall mobile dependencies:

```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```
