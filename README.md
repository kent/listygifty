# Listy Gifty Monorepo

Listy Gifty is a monorepo with:
- `apps/api`: Rails API
- `apps/web`: Next.js web app
- `apps/mobile`: Expo/React Native mobile app
- `packages/types`: shared TypeScript types
- `packages/api-client`: shared API client
- `packages/services`: shared service layer

## 1) Prerequisites

- Node.js 20.x and npm 10.x
- Ruby 3.4.x and Bundler
- `gcloud` CLI
- For mobile: run dependency install inside `apps/mobile` (it is intentionally decoupled from root workspaces)

## 2) Monorepo setup

From repository root:

```bash
npm install
npm run build
```

For API:

```bash
cd apps/api
bundle install
bin/rails db:prepare
```

For mobile (separate dependency tree):

```bash
cd apps/mobile
npm install --legacy-peer-deps
```

For Listy Gifty TestFlight releases:

```bash
npm run release -- patch
```

The release helper bumps the mobile version, commits it, pushes a matching
`v<version>` tag, and lets GitHub Actions queue the production-profile
TestFlight build. The default App Store Connect internal testing group is
`Internal Testers` for `kent.fenwick@gmail.com`.

Production App Store review is deliberately separate: run the `Mobile Release`
workflow with `release_action=app_store_review` after validating TestFlight.
See `docs/mobile-release.md`.

## 3) Local development

Boot an isolated PostgreSQL container plus the Rails and Next.js development
servers:

```bash
bin/local-preview up
```

The web app runs at `http://localhost:3000` and the API at
`http://localhost:3001`. Use `bin/local-preview status`, `test`, `e2e`,
`logs`, `restart`, `down`, or `reset` to manage the stack. The `e2e` command
uses five dedicated users in the Clerk development instance to exercise a
complete gift-exchange invitation and joining flow.

After a successful E2E run, open the resulting exchange as any test user:

```bash
bin/local-preview e2e-open owner
bin/local-preview e2e-open participant-1
```

Run API:

```bash
cd apps/api
bin/rails server -p 3001
```

Run web:

```bash
cd apps/web
npm run dev
```

Run mobile:

```bash
cd apps/mobile
npx expo start
```

## 4) Environment variables

Web (`apps/web/.env.local`):

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS=AA:BB:... # optional, comma/newline separated
```

Mobile (`apps/mobile/.env`):

```bash
EXPO_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

API:
- use Rails credentials and/or runtime environment variables

## 5) Testing guide

Root workspace checks:

```bash
npm run build
npm run test
```

API checks:

```bash
cd apps/api
bin/rails test
```

Web checks:

```bash
cd apps/web
npm run build
```

Mobile checks:

```bash
cd apps/mobile
npm test -- --runInBand
npx tsc --noEmit
```

## 6) Feature development workflow

Use this sequence to add features cleanly across the monorepo:

1. Add or update shared types in `packages/types/src/index.ts`.
2. Add or update API contracts in Rails (routes/controllers/blueprints).
3. Add or update shared services in `packages/services`.
4. Rebuild packages from root: `npm run build`.
5. Implement UI in web and/or mobile using shared types/services.
6. Add or update tests in affected apps.
7. Run app-level checks and then deploy to staging.

Guidelines:
- Prefer shared types/services over duplicating request logic in UI layers.
- Keep UI code focused on presentation/state orchestration, not low-level HTTP.
- Extract repeated formatting/UI patterns into shared modules (`apps/mobile/lib/*`, reusable components, etc.).

## 7) Deployment

Deployments are split by shipped surface. Use Pulumi for the Cloud Run API/web
stack, and use the `Mobile Release` workflow for TestFlight and App Store
control.

### Deployable Surfaces

| Surface | What Ships | Owner | Primary Release Path |
|---|---|---|---|
| API | Rails API, migrations, runtime secrets, Cloud SQL connection | Pulumi + Cloud Run | `npm run deploy` |
| Web | Next.js app, public web env, app-link metadata | Pulumi + Cloud Run | `npm run deploy` |
| Mobile TestFlight | Expo iOS store build, production API/web URLs, app assets from `apps/mobile/app.json` | GitHub Actions + EAS | `npm run release -- patch` or `Mobile Release` workflow |
| App Store Production | Promotion of a validated TestFlight build to App Review | GitHub Actions + App Store Connect | `Mobile Release` workflow with `app_store_review` |

### Cloud Run API And Web

Project:
- Project ID: `listygifty`
- Project number: `906707282968`
- Region: `us-central1`
- Pulumi state: `gs://listygifty-pulumi-state`

Canonical deploy commands:

```bash
gcloud config configurations activate listygifty
source .gcp/listygifty-deploy.env

npm run deploy
```

Staging is turned off pre-PMF (see `infra/pulumi/README.md` to re-enable).
Tests run locally with `npm test` — there is no CI gate on deploys.

Each Pulumi deploy:

1. Builds API and web images with Cloud Build.
2. Rolls Cloud Run revisions.
3. Updates and runs the Rails migration job.
4. Smoke-tests the new API/web revisions.
5. Prints deployed URLs and the source SHA.

Preview before applying:

```bash
npm run deploy:preview:staging
npm run deploy:preview:production
```

Skip mobile side effects during a backend/web hotfix:

```bash
cd infra/pulumi
pulumi up --stack production -c niftygifty:enableMobile=false
```

Validate production data after migration-heavy deploys:

```bash
source .gcp/listygifty-deploy.env
ENVIRONMENT=production HEROKU_APP=niftygifty-production npm run infra:verify-db
```

See `infra/pulumi/README.md` for bootstrap, imports, rollback, and resource
ownership.

### Mobile TestFlight

Default TestFlight target:
- EAS profile: `production`
- App Store Connect app: `6759929474`
- Bundle ID: `com.ewakened.niftygifty`
- Internal testing group: `Internal Testers`
- Default tester: `kent.fenwick@gmail.com`

Normal release-candidate flow:

```bash
npm run release -- patch
```

That helper requires a clean tree, bumps `apps/mobile/app.json`,
`apps/mobile/package.json`, and `apps/mobile/package-lock.json`, creates
`v<version>`, pushes the branch and tag, and lets GitHub Actions queue the
production-profile TestFlight build.

Manual TestFlight dispatch:

1. Open GitHub Actions.
2. Run `Mobile Release`.
3. Choose `release_action=testflight`.
4. Keep `eas_profile=production` unless intentionally testing staging.

The workflow runs mobile quality gates, queues `eas build --profile production
--platform ios --auto-submit --no-wait`, then verifies through App Store
Connect that the processed build is attached to `Internal Testers`.

Local emergency TestFlight command:

```bash
cd apps/mobile
npx eas-cli build --profile production --platform ios --auto-submit --non-interactive
```

### App Store Production Promotion

Public production release is deliberately separate from TestFlight. After the
TestFlight build is validated:

1. Open GitHub Actions.
2. Run `Mobile Release`.
3. Choose `release_action=app_store_review`.
4. Set `app_version` if promoting a version other than the current
   `apps/mobile/app.json` version.
5. Keep `app_store_release_type=MANUAL` unless automatic release after Apple
   approval is intentional.

The `mobile-production` GitHub environment requires reviewer approval before
the App Store review job runs.

### Required Secrets And Access

GitHub Actions secrets:
- `EXPO_TOKEN`
- `APP_STORE_CONNECT_API_KEY_P8`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`
- `CLERK_PUBLISHABLE_KEY_PROD`
- `CLERK_PUBLISHABLE_KEY_STAGING`
- `POSTHOG_KEY` and `POSTHOG_HOST` when analytics are enabled for web builds

Local deploy files:
- `.gcp/listygifty-deploy.env`
- `.gcp/keys/listygifty-deployer.json`
- `apps/mobile/AuthKey_2XG664G4GG.p8` for local EAS submit diagnostics only

Never commit local key files. `apps/mobile/.gitignore` excludes `.p8`,
certificates, provisioning profiles, native build folders, and credentials.

### CI/CD Branch Policy

- Push to `staging`: `deploy-api.yml` and `deploy-web.yml` deploy changed
  API/web surfaces to staging; `mobile-release.yml` runs the mobile quality
  gate when mobile or shared package files change.
- Push to `main`: `deploy-api.yml` and `deploy-web.yml` deploy changed API/web
  surfaces to production; `mobile-release.yml` runs the mobile quality gate for
  mobile changes and does not queue TestFlight.
- Push a `v<version>` tag: queue a production-profile TestFlight build for
  that exact mobile version.
- App Store review always requires manual `Mobile Release` dispatch.

## 8) Domains and target services

Production:
- `listygifty.com` -> `niftygifty-web`
- `www.listygifty.com` -> `niftygifty-web`
- `api.listygifty.com` -> `niftygifty-api`

Staging:
- `staging.listygifty.com` -> `niftygifty-staging-web`
- `api-staging.listygifty.com` -> `niftygifty-staging-api`

## 9) Verification And Rollback

Check Cloud Run services:

```bash
gcloud run services describe niftygifty-api --region us-central1 --project listygifty
gcloud run services describe niftygifty-web --region us-central1 --project listygifty
```

Check EAS builds and TestFlight submissions:

```bash
cd apps/mobile
npx eas-cli build:list --platform ios --limit 5
npx eas-cli submit:list --platform ios --limit 5
```

Rollback API/web through Pulumi by redeploying a prior SHA:

```bash
cd infra/pulumi
pulumi up --stack production -c niftygifty:sourceSha=<previous-sha>
```

Mobile rollback means submitting a new App Store/TestFlight build with the
desired code and a higher iOS build number; Apple does not allow reusing an old
build number.

## 10) Infra runbook

For infrastructure provisioning, secret sync, DB migration, and detailed ops procedures:
- `infra/gcp/README.md`
