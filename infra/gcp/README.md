# GCP Migration Runbook (Cloud Run + Cloud SQL)

This folder contains scripts to migrate a Heroku deployment to GCP project `listygifty` with separate `production` and `staging` environments.

## Target architecture

- API: Cloud Run services `niftygifty-api` (prod) and `niftygifty-staging-api` (staging)
- Web: Cloud Run services `niftygifty-web` (prod) and `niftygifty-staging-web` (staging)
- Database: Cloud SQL Postgres instance `niftygifty-postgres` with separate DB/user per environment
- Images: Artifact Registry `${ARTIFACT_REGION:-us-central1}-docker.pkg.dev/listygifty/niftygifty/*`
- Secrets: Secret Manager (environment-prefixed secret names)

## Prerequisites

- `gcloud`, `heroku`, `jq`, `psql`, `pg_dump`, `pg_restore`, `cloud-sql-proxy`
- Logged in to GCP and Heroku
- Billing enabled on the `listygifty` project
- Your domain (`listygifty.com`) verified in Google Search Console for this GCP account before Cloud Run domain mapping

## Fast path: test + deploy staging + production

```bash
source .gcp/listygifty-deploy.env
npm run gcp:release
```

`gcp:release` runs local API/web checks, deploys staging API + web, runs staging smoke checks, deploys production API + web, and runs production smoke checks.

Optional:

```bash
SKIP_TESTS=1 npm run gcp:release
```

## 1) Load an environment profile

For production:

```bash
cp infra/gcp/env.production.gcp.example .env.gcp
set -a
source .env.gcp
set +a
```

For staging:

```bash
cp infra/gcp/env.staging.gcp.example .env.gcp
set -a
source .env.gcp
set +a
```

## 2) Provision base infrastructure

```bash
bash infra/gcp/scripts/bootstrap.sh
```

This script:
- enables required APIs
- creates Artifact Registry
- creates runtime service account + IAM
- creates Cloud SQL database/user for the active `ENVIRONMENT`
- creates/updates DB secrets for the active `ENVIRONMENT`

## 3) Migrate all Heroku env vars into Secret Manager

```bash
bash infra/gcp/scripts/sync-heroku-secrets.sh
```

This script:
- copies all Heroku config vars into environment-scoped GCP secrets
- writes a generated binding map at `.gcp/heroku-secret-bindings-${ENVIRONMENT}.env`
- stores Heroku `DATABASE_URL` as `HEROKU_DATABASE_URL` by default (to avoid overriding Cloud SQL `DATABASE_URL`)

## 4) Migrate Heroku Postgres data

```bash
bash infra/gcp/scripts/migrate-heroku-db.sh
bash infra/gcp/scripts/verify-migration.sh
```

`migrate-heroku-db.sh` performs `pg_dump` from Heroku and `pg_restore` into Cloud SQL through Cloud SQL Auth Proxy.

## 5) Deploy API

```bash
bash infra/gcp/scripts/deploy-api.sh
```

This builds the API image, runs Rails migrations via Cloud Run Job, deploys the API service for the active environment, and applies extra secret bindings from `.gcp/heroku-secret-bindings-${ENVIRONMENT}.env`.

Performance defaults for API deploys:
- Ruby `3.4.8` runtime image with `jemalloc`
- `RUBY_YJIT_ENABLE=1` in container plus `RAILS_ENABLE_YJIT=true`
- Puma tunables exposed as env vars (`RAILS_MAX_THREADS`, `RAILS_MIN_THREADS`, `WEB_CONCURRENCY`, `PUMA_PERSISTENT_TIMEOUT`)
- DB/queue connection controls exposed as env vars (`DB_POOL`, `JOB_THREADS`, `JOB_CONCURRENCY`)

## 6) Deploy web

```bash
bash infra/gcp/scripts/deploy-web.sh
```

This builds the web image with environment-specific `NEXT_PUBLIC_*` values, deploys the web service for the active environment, and applies extra server-side secret bindings from `.gcp/heroku-secret-bindings-${ENVIRONMENT}.env`.

## 7) Repeat for the other environment

Run steps 1-6 once with `ENVIRONMENT=staging` profile and once with `ENVIRONMENT=production` profile.

## 8) Cut over domains

Production mappings:
- `api.listygifty.com` -> `niftygifty-api`
- `listygifty.com` + `www.listygifty.com` -> `niftygifty-web`

Staging mappings (recommended):
- `api-staging.listygifty.com` -> `niftygifty-staging-api`
- `staging.listygifty.com` -> `niftygifty-staging-web`

Then update DNS records exactly as Cloud Run domain mapping instructs.

## 9) Configure GitHub auto-deploy triggers

Goal:
- push to `staging` -> deploy `staging`
- push to `main` -> deploy `production`

One-time setup:

```bash
# 1) Create GitHub connection (prints OAuth/App setup URL)
gcloud builds connections create github niftygfity-github \
  --project=listygifty \
  --region=us-central1

# 2) Complete the OAuth + GitHub App installation flow in browser.

# 3) Create/update repository mapping + triggers
bash infra/gcp/scripts/configure-github-triggers.sh
```

This configures:
- trigger `niftygfity-deploy-staging` for `^staging$`
- trigger `niftygfity-deploy-production` for `^main$`

Both triggers run `infra/gcp/cloudbuild.deploy.yaml`, which deploys API + web using:
- production bindings: `infra/gcp/secret-bindings.production.env`
- staging bindings: `infra/gcp/secret-bindings.staging.env`

## Suggested cutover process

1. Deploy staging and production on `run.app` URLs and smoke test both.
2. Freeze production writes briefly (maintenance mode or disable mutating endpoints).
3. Run final production `migrate-heroku-db.sh` for zero/low drift.
4. Update production DNS to Cloud Run mappings.
5. Monitor logs/errors for 30-60 minutes.
6. Keep old platform services up for rollback window (24-48 hours), then decommission.

## Rollback

- Point DNS back to previous targets.
- Original Heroku database remains intact unless explicitly modified/destroyed.
