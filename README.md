# Listy Gifty Monorepo

Listy Gifty is a monorepo with:
- `apps/api`: Rails API
- `apps/web`: Next.js web app
- `apps/mobile`: Expo/React Native mobile app
- `packages/types`: shared TypeScript types
- `packages/api-client`: shared API client
- `packages/services`: shared service layer

## 1) Prerequisites

- Node.js 22.x and npm 10.x
- Ruby 3.4.x and Bundler
- Docker with Compose for the local preview stack
- Pulumi CLI for infrastructure previews and deployments
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

For TestFlight, merge a reviewed pull request, wait for the production `Deploy`
run for that exact merge commit, then comment `/testflight` on the merged PR.
The production profile targets `Internal Testers` for `kent.fenwick@gmail.com`.
App Store review is a separate `Mobile Release` dispatch after validation.
See [the mobile release runbook](docs/mobile-release.md).

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
./bin/lint
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
7. Run app-level checks and local browser flows, then use the reviewed pull request flow. Production deploys automatically after merge; staging is disabled.

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
| Mobile TestFlight | Expo iOS store build, production API/web URLs, app assets from `apps/mobile/app.json` | GitHub Actions + EAS | `/testflight` on a merged PR or a `main` dispatch of `Mobile Release` |
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
Pull-request CI runs API, web, shared client/service, MCP and mobile tests, builds,
static checks and dependency scans. The `Deploy` workflow runs on relevant `main`
pushes; it relies on the reviewed merge and branch protection for those checks.
The local deploy wrapper itself does not run the test suites.

Each Pulumi deploy:

1. Builds API and web images with Cloud Build.
2. Rolls the web revision and updates the Rails migration job image.
3. Runs migrations before rolling the API revision.
4. Smoke-tests the new API/web revisions.
5. Prints deployed URLs and the source SHA.

Preview the current production stack configuration:

```bash
npm run deploy:preview
```

`npm run deploy` deploys API/web only. `npm run deploy:mobile` additionally queues
an iOS build after migrations, rollout and smoke checks succeed.

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

1. Include any mobile version bump in a pull request; keep `app.json`,
   `package.json` and the mobile lockfile version synchronized.
2. Wait for required checks and merge without bypassing branch protection.
3. Wait for the successful production `Deploy` run for that exact commit.
4. Comment exactly `/testflight` on the merged PR and monitor build, Apple
   processing and `Internal Testers` verification.

Manual TestFlight dispatch:

1. Open GitHub Actions.
2. Run `Mobile Release` from `main`.
3. Choose `release_action=testflight`.
4. Keep `eas_profile=production`. Staging infrastructure is disabled.

The workflow runs mobile quality gates, queues `eas build --profile production
--platform ios --auto-submit --no-wait`, then verifies through App Store
Connect that the processed build is attached to `Internal Testers`.

Local diagnostics can use EAS directly only from a clean, already merged commit
whose production deploy succeeded:

```bash
cd apps/mobile
npx eas-cli build --profile production --platform ios --auto-submit --non-interactive
```

### App Store Production Promotion

Public production release is deliberately separate from TestFlight. After the
TestFlight build is validated:

1. Open GitHub Actions.
2. Run `Mobile Release` from `main`.
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

Local deploy files:
- `.gcp/listygifty-deploy.env`
- `.gcp/keys/listygifty-deployer.json`
- `apps/mobile/AuthKey_2XG664G4GG.p8` for local EAS submit diagnostics only

Never commit local key files. `apps/mobile/.gitignore` excludes `.p8`,
certificates, provisioning profiles, native build folders, and credentials.

### CI/CD Branch Policy

- Pull requests run `.github/workflows/ci.yml`.
- Relevant pushes to `main` run `.github/workflows/deploy.yml` for production.
- Staging has no active deploy workflow or infrastructure.
- `/testflight` on a merged PR, a `v<version>` tag already contained in `main`,
  or a manual `main` dispatch starts the mobile release workflow.
- App Store review requires manual `Mobile Release` dispatch.

## 8) Domains and target services

Production:
- `listygifty.com` -> `niftygifty-web`
- `www.listygifty.com` -> `niftygifty-web`
- `api.listygifty.com` -> `niftygifty-api`

Staging is disabled. Historical domains and EAS staging profiles are not an
operational environment; follow `infra/pulumi/README.md` before re-enabling it.

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
```

Review submissions in the Expo project dashboard and App Store Connect.

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
