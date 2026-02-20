# NiftyGifty Monorepo

NiftyGifty (Listy Gifty) is a monorepo with:
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

## 3) Local development

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

## 7) Staging and production deployment (GCP)

Project:
- Project ID: `listygifty`
- Project number: `906707282968`
- Region: `us-east1`

### One-command release (recommended)

Load deployment profile:

```bash
source .gcp/listygifty-deploy.env
```

Release staging and production:

```bash
npm run gcp:release
```

This runs:
- local API tests + web production build
- staging API/web deploy + smoke tests
- production API/web deploy + smoke tests

Optional (skip local prechecks):

```bash
SKIP_TESTS=1 npm run gcp:release
```

### Manual deploy by environment

Staging:

```bash
ENVIRONMENT=staging HEROKU_SECRET_BINDINGS_FILE=infra/gcp/secret-bindings.staging.env npm run gcp:deploy:api
ENVIRONMENT=staging HEROKU_SECRET_BINDINGS_FILE=infra/gcp/secret-bindings.staging.env npm run gcp:deploy:web
```

Production:

```bash
ENVIRONMENT=production HEROKU_SECRET_BINDINGS_FILE=infra/gcp/secret-bindings.production.env npm run gcp:deploy:api
ENVIRONMENT=production HEROKU_SECRET_BINDINGS_FILE=infra/gcp/secret-bindings.production.env npm run gcp:deploy:web
```

### Validate production data counts

Compare production table counts:

```bash
source .gcp/listygifty-deploy.env
ENVIRONMENT=production HEROKU_APP=niftygifty-production bash infra/gcp/scripts/verify-migration.sh
```

## 8) CI/CD branch policy

- Push to `staging` branch -> deploy staging
- Push to `main` branch -> deploy production

One-time trigger configuration:

```bash
bash infra/gcp/scripts/configure-github-triggers.sh
```

## 9) Domains and target services

Production:
- `listygifty.com` -> `niftygifty-web`
- `www.listygifty.com` -> `niftygifty-web`
- `api.listygifty.com` -> `niftygifty-api`

Staging:
- `staging.listygifty.com` -> `niftygifty-staging-web`
- `api-staging.listygifty.com` -> `niftygifty-staging-api`

## 10) Infra runbook

For infrastructure provisioning, secret sync, DB migration, and detailed ops procedures:
- `infra/gcp/README.md`
