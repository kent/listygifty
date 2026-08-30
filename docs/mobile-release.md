# Mobile Release

Listy Gifty's iOS release path is CI-owned. Local machines can still run EAS
for diagnostics, but shared TestFlight and App Store promotion should use the
`Mobile Release` GitHub Actions workflow. Cursor Cloud can prepare and merge
the code from Cursor Mobile; GitHub and EAS own the credentials, build, submit,
and App Store Connect verification steps. No local computer is required.

## Ship From Cursor Mobile

Just tell Cursor Mobile:

```text
Deploy to TestFlight
```

Natural spacing, capitalization, and obvious spelling mistakes are accepted,
including `deploy to test lfihgt`. You do not need to mention GitHub Actions,
`/testflight`, EAS, credentials, or a build profile. Cursor Mobile will:

1. Finish the requested change and normal pull request flow, wait for required
   checks, and merge without bypassing branch protection.
2. Resolve the exact merge commit on `main`. For changes under the API, web,
   mobile, shared packages, infrastructure, or deploy scripts, wait for the
   production `Deploy` workflow for that commit to complete successfully.
3. Add a top-level comment to the merged pull request whose complete body is:

   ```text
   /testflight
   ```

   If the current `main` commit has no suitable merged pull request, Cursor
   Mobile will manually dispatch **Mobile Release** from `main` with the
   `testflight` action and `production` EAS profile instead.
4. Monitor **Mobile Release / Queue TestFlight Build** until it tests the app,
   builds and submits the exact commit, waits for Apple to process that build,
   and verifies its attachment to `Internal Testers`.
5. Report the verified build number and relevant workflow/build links. Merely
   queueing the workflow is not completion.

A request to configure, document, or verify the release process is not a
release request and must not queue a build. Cursor acts only when the user
clearly asks to deploy, ship, or release the app to TestFlight.

The `/testflight` command is an implementation detail and manual fallback. Its
trigger accepts only an exact `/testflight` comment from a
repository owner, member, or collaborator, and only for a pull request already
merged into `main`. Apple and Expo credentials remain in GitHub Actions and
must never be placed in Cursor Cloud secrets, commits, pull requests, comments,
or logs.

The production deploy begins automatically when the PR is merged. If a release
needs one serialized recovery run, open **GitHub → `kent/listygifty` → Actions
→ Deploy → Run workflow**, select `main`, enable **Queue the iOS EAS build after
web/API deploy**, and run it. That path queues TestFlight only after the backend
rollout and smoke tests succeed.

If the backend is already healthy and only TestFlight needs to be retried, open
**Actions → Mobile Release → Run workflow**, select `main`, keep `testflight`
and the `production` EAS profile selected, and run it. Do not rerun a workflow
that already queued a successful build merely because App Store processing is
slow; the workflow itself waits for and verifies the exact build.

## TestFlight

Normal pushes do not queue TestFlight builds. Shared TestFlight releases are
controlled by a `/testflight` comment on a merged `main` pull request, a version
tag, or manual workflow dispatch from `main`.

Version tags (`v1.2.3`) queue a production-profile TestFlight build. The tag
must match `apps/mobile/app.json`'s `expo.version`. The workflow queues EAS
with auto-submit and then polls App Store Connect until the processed build is
attached to the tester group:

```bash
eas build --profile production --platform ios --auto-submit --non-interactive --no-wait
```

The production submit profile adds the uploaded build to the App Store Connect
`Internal Testers` group, which contains `kent.fenwick@gmail.com`. This keeps
TestFlight on the same app identifier and release configuration that users will
eventually receive. CI also identifies the exact EAS build it queued and
verifies that exact build is attached to `Internal Testers` through the App
Store Connect API before the run is considered complete.

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

Manual mobile releases and manual production deploys refuse to run from any
branch other than `main`. Version tags must point to commits already contained
in `main`.

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

These secrets belong in GitHub Actions, not in Cursor Cloud. Cursor's Linux
worker does not need either secret because EAS performs the hosted iOS build.

## Credential Health

The `Mobile Credential Check` workflow runs monthly and can be run manually. It
fails if EAS remote iOS signing credentials are inside the 30-day expiry window
and warns inside 90 days.
