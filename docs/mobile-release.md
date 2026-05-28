# Mobile Release

Listy Gifty's iOS release path is CI-owned. Local machines can still run EAS
for diagnostics, but shared TestFlight and App Store promotion should use the
`Mobile Release` GitHub Actions workflow.

## Automatic TestFlight

Pushes to `staging` or `main` that touch the mobile app, shared packages, or
release scripts run the mobile quality gate and then queue an iOS EAS build
with the `production` profile:

```bash
eas build --profile production --platform ios --auto-submit --non-interactive --wait
```

The production submit profile adds the uploaded build to the App Store Connect
`Internal Testers` group. This keeps TestFlight on the same app identifier and
release configuration that users will eventually receive. CI also verifies the
uploaded build is attached to `Internal Testers` through the App Store Connect
API before the run is considered complete.

Version tags (`v1.2.3`) also queue a production-profile TestFlight build. The
tag must match `apps/mobile/app.json`'s `expo.version`.

## Production Release Control

Production App Store review is a separate manual promotion. After a TestFlight
build has been validated and Apple has processed it:

1. Open the `Mobile Release` workflow in GitHub Actions.
2. Run workflow.
3. Set `release_action` to `app_store_review`.
4. Set `app_version` if promoting a version other than the current
   `apps/mobile/app.json` version.
5. Keep `app_store_release_type` as `MANUAL` unless you intentionally want the
   app to release automatically after approval.

Configure the GitHub environment named `mobile-production` with required
reviewers when public production releases need an approval gate in GitHub. The
repo is currently configured with `kent` as the required reviewer for
`mobile-production`; `mobile-testflight` has no approval gate so TestFlight
validation builds can move quickly.

## Version And Tag Helper

Use the root helper when it is time to make a release candidate:

```bash
npm run release -- patch
npm run release -- minor
npm run release -- 1.2.3
```

The helper requires a clean working tree, bumps the mobile app version, commits
the change, creates `v<version>`, and pushes the branch and tag. The tag queues
TestFlight; it does not submit the app for App Store review.

## Required GitHub Secrets

- `EXPO_TOKEN`
- `APP_STORE_CONNECT_API_KEY_P8`

The App Store Connect key metadata is committed in `apps/mobile/eas.json` and
`.github/workflows/mobile-release.yml` (`2XG664G4GG` on issuer
`69a6de6e-8f71-47e3-e053-5b8c7c11a4d1`); the private key body stays in the
GitHub secret.

`EXPO_TOKEN` must be created from the Expo dashboard access-token page for
`kentf` and added as a GitHub Actions secret. Expo does not expose token
creation through the current EAS CLI.

## Credential Health

The `Mobile Credential Check` workflow runs monthly and can be run manually. It
fails if EAS remote iOS signing credentials are inside the 30-day expiry window
and warns inside 90 days.
