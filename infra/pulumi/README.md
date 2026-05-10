# Pulumi infrastructure for listygifty.com

Every step of a deploy — container builds, Cloud Run rollout, Cloud Run IAM,
Secret Manager access, the migration job, the migration *execution*, domain
mappings, smoke tests, and the EAS mobile build — is declared as a Pulumi
resource in `src/stack.ts`. One command per environment runs the entire
pipeline:

```bash
npm run deploy:staging      # build → roll → migrate → smoke → EAS staging
npm run deploy:production   # same, against prod stack
```

State lives in **`gs://listygifty-pulumi-state`** (self-hosted GCS backend
declared in `Pulumi.yaml`). No Pulumi Cloud account needed.

---

## Architecture

```
git HEAD ──┐
           │ (sourceSha config)
           ▼
   ┌───────────────────┐    ┌───────────────────┐
   │  build-api        │    │  build-web        │   ← Cloud Build, parallel
   │  (gcloud builds)  │    │  (gcloud builds)  │
   └─────────┬─────────┘    └─────────┬─────────┘
             │                        │
             ▼                        ▼
   ┌───────────────────┐    ┌───────────────────┐
   │ api Cloud Run     │    │ web Cloud Run     │
   │ + IAM allUsers    │    │ + IAM allUsers    │
   │ + Cloud SQL mount │    │                   │
   └─────────┬─────────┘    └─────────┬─────────┘
             │                        │
             ▼                        │
   ┌───────────────────┐              │
   │ api-migrate       │              │
   │ Cloud Run job     │              │
   │ + run-migrations  │              │
   └─────────┬─────────┘              │
             │      ┌─────────────────┘
             ▼      ▼
        ┌────────────────┐
        │  smoke-tests   │      ← /up, /holidays (401), web /, /login
        └────────┬───────┘
                 ▼
        ┌────────────────┐
        │  eas-build     │      ← TestFlight (staging) or App Store (prod)
        └────────────────┘
```

Pulumi runs independent resources concurrently. `build-api` and `build-web`
have no dependency on each other so they execute in parallel.

---

## What is and isn't managed by Pulumi

**Managed (Pulumi is the source of truth):**

| Resource | Notes |
|---|---|
| Artifact Registry repo `niftygifty` | `protect: true` |
| Runtime service accounts | One per environment |
| Cloud Run API + web services | `deletionProtection: true` in production |
| Cloud Run migration job | Image kept in lockstep with API service |
| Secret Manager IAM bindings | Pulumi grants accessor, never reads/writes values |
| Cloud Run domain mappings | `staging.listygifty.com`, `api-staging.listygifty.com`, prod equivalents |

**Referenced read-only (Pulumi never modifies):**

| Resource | Why |
|---|---|
| Cloud SQL instance `niftygifty-postgres` | Manual ops only — too dangerous to manage |
| Secret Manager **values** | Rotated via `sync-heroku-secrets.sh` |
| GitHub Cloud Build triggers | `configure-github-triggers.sh` |

---

## First-time bootstrap

```bash
# 1. Auth — gcloud should already be authed to listygifty.
source .gcp/listygifty-deploy.env

# 2. Create the state bucket with versioning.
gcloud storage buckets create gs://listygifty-pulumi-state \
  --project=listygifty --location=us-east1 \
  --uniform-bucket-level-access --no-public-access-prevention
gcloud storage buckets update gs://listygifty-pulumi-state --versioning

# 3. Install pulumi + eas locally.
brew install pulumi/tap/pulumi
npm i -g eas-cli

# 4. Login Pulumi to the GCS backend.
pulumi login gs://listygifty-pulumi-state

# 5. Install Pulumi deps.
cd infra/pulumi && npm install

# 6. Create both stacks.
pulumi stack init staging
pulumi stack init production

# 7. Import existing GCP resources — see "Importing" below.
```

---

## Importing existing resources

Because staging + production are already running, the first `pulumi up` must
*adopt* what's there rather than try to create duplicates. Run these imports
once per stack.

```bash
cd infra/pulumi
pulumi stack select staging

# Artifact Registry (shared; only import once on whichever stack you pick first)
pulumi import gcp:artifactregistry/repository:Repository container-images \
  projects/listygifty/locations/us-east1/repositories/niftygifty --yes

# Runtime SA
pulumi import gcp:serviceaccount/account:Account runtime-sa \
  projects/listygifty/serviceAccounts/niftygifty-staging-runner@listygifty.iam.gserviceaccount.com --yes

# Cloud Run services + job
pulumi import gcp:cloudrunv2/service:Service api-service \
  projects/listygifty/locations/us-east1/services/niftygifty-staging-api --yes
pulumi import gcp:cloudrunv2/service:Service web-service \
  projects/listygifty/locations/us-east1/services/niftygifty-staging-web --yes
pulumi import gcp:cloudrunv2/job:Job api-migrate \
  projects/listygifty/locations/us-east1/jobs/niftygifty-staging-api-migrate --yes

# Domain mappings (skip if they don't exist yet for this env)
pulumi import gcp:cloudrun/domainMapping:DomainMapping api-domain \
  locations/us-east1/namespaces/listygifty/domainmappings/api-staging.listygifty.com --yes
pulumi import gcp:cloudrun/domainMapping:DomainMapping web-domain \
  locations/us-east1/namespaces/listygifty/domainmappings/staging.listygifty.com --yes
```

Repeat with `production` stack + unsuffixed names (`niftygifty-api`,
`niftygifty-web`, `niftygifty-api-migrate`, `api.listygifty.com`,
`listygifty.com`).

After every import: `pulumi refresh --yes` then `pulumi preview`. The preview
should be small or empty before the first `pulumi up`.

---

## Day-to-day deploy

```bash
npm run deploy:staging
npm run deploy:production
```

Both do (in this order, with the build steps running concurrently):

1. Compute git SHA → feed it as `niftygifty:sourceSha` config
2. `pulumi up --yes --skip-preview` — Pulumi engine runs:
   - `gcloud builds submit` for API + web (parallel, registry-cached)
   - Cloud Run revision rollouts to the new image
   - Migration job image update
   - Migration job execution (`gcloud run jobs execute --wait`)
   - Curl smoke endpoints (`/up`, `/holidays` → 401, web `/`, `/login`)
   - `eas build --no-wait --auto-submit`
3. Print URLs + elapsed time

If `pulumi up` runs twice with the same SHA, every `command.local.Command`
sees an unchanged `triggers` array and skips. Pulumi diffs the Cloud Run
resources and reports no changes. Unchanged redeploys are no-ops in seconds.

### Expected timings

| Scenario | Wall time | Bottleneck |
|---|---|---|
| Cold deploy (no image cache) | ~5–7 min | Cloud Build (`E2_HIGHCPU_8`) building Rails + Next images from scratch |
| Warm deploy (registry cache hit) | ~2–3 min | Cloud Build pulling layers + Cloud Run revision rollout |
| No-change redeploy | ~10–20 s | Pulumi state read + diff only |
| Migration-only (DB schema change) | ~30–60 s | Cloud Run job execution |

Steps that drive the wall time:

- **Image builds (parallel)** — `E2_HIGHCPU_8` Cloud Build with BuildKit
  registry cache (`--cache-from=:cache --cache-to=type=inline`). The cache
  tag persists per repository so subsequent builds reuse layers.
- **Cloud Run rollout** — Cloud Run waits for at least one healthy revision
  before shifting traffic. Min instances = 1 on production keeps a warm pod.
- **Smoke tests** — four serial curl calls with 15 s timeouts. ~3 s total.
- **EAS build** — fire-and-forget; the Pulumi resource returns once the
  build is *queued* on Expo's infra. Actual ipa/aab build takes 15–30 min
  on Expo's side and posts to TestFlight / Play when done.

### Knobs

- `pulumi up -c niftygifty:enableMobile=false` — skip EAS for this run
- `pulumi up -c niftygifty:sourceSha=<sha>` — roll a specific image tag
  (useful for rollback)

### Rollback

Cloud Run keeps prior revisions. Two options:

**Pulumi-driven (preserves IaC truth):**
```bash
cd infra/pulumi
pulumi up --stack production -c niftygifty:sourceSha=<previous-sha>
```

**Fast manual (out-of-band):**
```bash
gcloud run services update-traffic niftygifty-api \
  --region=us-east1 --to-revisions=<previous-revision>=100
```

---

## Mobile (EAS)

`apps/mobile/eas.json` defines `staging` and `production` build profiles with
environment-specific API URLs. Submit profiles ship to TestFlight (staging)
and App Store / Play production (production).

**First-time mobile setup:**

```bash
cd apps/mobile
eas login
eas init       # Links to Expo project ID

# Replace REPLACE_WITH_* placeholders in eas.json with the actual
# Apple Team ID / ASC App ID. Then:
eas credentials   # Walks you through setting up signing creds
```

After that, every `npm run deploy:*` from the repo root fires
`eas build --auto-submit` automatically. The build runs on Expo's
infrastructure (15-30 min) and TestFlight / App Store ingestion follows.

To skip mobile for a backend-only hotfix:

```bash
pulumi up --stack production -c niftygifty:enableMobile=false
```
