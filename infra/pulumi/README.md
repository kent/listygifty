# Pulumi infrastructure for listygifty.com

The production deploy wrapper builds immutable API/web images, then hands their
SHA to Pulumi for the ordered Cloud Run, migration, IAM, and smoke-test rollout.
An optional mobile release is queued by the wrapper only after Pulumi succeeds.
One command runs the complete production pipeline:

```bash
npm run deploy              # build → migrate → roll → smoke (production)
npm run deploy:mobile       # same, plus queue the iOS EAS build
```

> **Staging is turned off** (stack destroyed 2026-07-30, pre-PMF speed mode).
> Re-enabling it requires a reviewed, current `us-central1` stack configuration
> and infrastructure plan; historical stack files and resource names are not a
> safe bootstrap procedure. Retained secret containers do not imply that a live
> staging service exists.

State lives in **`gs://listygifty-pulumi-state`** (self-hosted GCS backend
declared in `Pulumi.yaml`). No Pulumi Cloud account needed.

---

## Architecture

```
git HEAD ──┬───────────────────────────┐
           │                           │
           ▼                           ▼
   ┌───────────────────┐       ┌───────────────────┐
   │  build-api        │       │  build-web        │   ← Cloud Build, parallel
   └─────────┬─────────┘       └─────────┬─────────┘
             │                           │
             ▼                           ▼
   ┌───────────────────┐       ┌───────────────────┐
   │ api-migrate job   │       │ web Cloud Run     │
   │ image update      │       │ + IAM allUsers    │
   └─────────┬─────────┘       └─────────┬─────────┘
             │                           │
             └─────────────┬─────────────┘
                           ▼
                 ┌───────────────────┐
                 │ run-migrations    │   ← starts only after web is ready
                 └─────────┬─────────┘
                           ▼
                 ┌───────────────────┐
                 │ api Cloud Run     │   ← starts only after schema succeeds
                 │ + IAM allUsers    │
                 │ + Cloud SQL mount │
                 └─────────┬─────────┘
                           ▼
                  ┌────────────────┐
                  │  smoke-tests   │   ← health, OAuth discovery/consent, auth challenge
                  └────────┬───────┘
                           ▼
                  ┌────────────────┐
                  │  eas-build     │   ← optional production App Store/TestFlight build
                  └────────────────┘
```

The deploy wrapper runs API and web Cloud Builds concurrently, then invokes
Pulumi. Pulumi gates the release in strict order: web rollout, migration-job
image update and migration execution, then API rollout and smoke tests.
Migrations must remain backward-compatible with the old API revision that serves
traffic until the final gate succeeds.

---

## What is and isn't managed by Pulumi

The production stack is configured by `Pulumi.production.yaml` in project
`listygifty`, region `us-central1`. Current production resource names are:

- API service: `listygifty-api-prod`
- Web service: `listygifty-web-prod`
- Migration job: `listygifty-migrate-prod`
- Cloud SQL instance (read-only reference): `niftygifty-postgres-central`

**Managed by this program:** the web runtime service account, Secret Manager
containers (never secret values), the production Active Storage bucket and IAM,
Cloud Run API/web services and public invoker IAM, the migration job, migration
execution, and smoke tests. The wrapper restores the tracked stack YAML after
`pulumi up` (including on failure); deployed config remains in remote state.
Image builds and optional EAS submission are wrapper
steps, not Pulumi resources.

**Referenced or managed out-of-band:** Cloud SQL, raw Secret Manager values,
container registries, GitHub triggers, DNS, TLS, and Cloud Run domain mappings.
Domain mappings are intentionally not Pulumi resources; see the comment in
`src/stack.ts`. Never import or delete them based on this stack.

---

## Bootstrap and state recovery

Production is already bootstrapped. On a new operator machine, attach to the
existing state rather than creating resources or another stack:

```bash
gcloud config configurations activate listygifty
source .gcp/listygifty-deploy.env
pulumi login gs://listygifty-pulumi-state
cd infra/pulumi
npm ci
pulumi stack select production
pulumi refresh --yes
pulumi preview
```

The preview must reference `us-central1` and the exact `*-prod` names above.
Staging is disabled; do not initialize or import a staging stack during normal
recovery.

If the production stack or GCS state appears missing, **stop before running
`pulumi stack init`, `pulumi import`, or `pulumi up`**. First restore the
versioned objects in `gs://listygifty-pulumi-state` and compare live resources
with `Pulumi.production.yaml` and `src/stack.ts`. Imports are a disaster-recovery
operation and must use IDs read from the live `listygifty` project—never the
historical `niftygifty-*`/`us-east1` examples. Domain mappings remain
out-of-band even during recovery.

---

## Day-to-day deploy

```bash
npm run deploy
```

## Android App Links

The web service exposes `/.well-known/assetlinks.json` for exchange invite
links. Set the Android signing certificate fingerprint per stack before
production App Links verification:

```bash
pulumi config set niftygifty:androidAppLinkSha256CertFingerprints "AA:BB:..."
```

Use comma-separated or newline-separated values when staging and production
need multiple fingerprints.

`npm run deploy` does the following:

1. Verifies the production worktree is clean and computes the git SHA.
2. Runs API and web `gcloud builds submit` jobs in parallel and waits for both.
3. Calls `pulumi up --yes --skip-preview` with `niftygifty:sourceSha=<sha>`.
   Pulumi rolls web first, executes the migration job, rolls API only after the
   schema succeeds, and then runs the smoke suite.
4. Prints the deployed URLs, revisions, SHA, and elapsed time.

`npm run deploy:mobile` performs the same release, then the wrapper runs
`eas build --no-wait --auto-submit`. Ordinary `npm run deploy` does not queue a
mobile build. Calling `pulumi up` directly never builds container images or
submits EAS; the requested SHA tag must already exist in the registry.

A repeated wrapper deploy still invokes Cloud Build for both images. Pulumi's
migration/smoke command triggers and Cloud Run resources are idempotent for an
unchanged SHA, but do not describe the wrapper build time as a no-op.

### Expected timings

| Scenario | Wall time | Bottleneck |
|---|---|---|
| Cold deploy (no image cache) | ~5–7 min | Cloud Build (`E2_HIGHCPU_8`) building Rails + Next images from scratch |
| Warm deploy (registry cache hit) | ~2–3 min | Cloud Build pulling layers + Cloud Run revision rollout |
| Direct Pulumi no-change | ~10–20 s | Pulumi state read + diff only (no builds) |
| Repeated wrapper deploy | ~2–3 min | Cloud Builds still run before Pulumi |
| Migration-only (DB schema change) | ~30–60 s | Cloud Run job execution |

Steps that drive the wall time:

- **Image builds (parallel)** — `E2_HIGHCPU_8` Cloud Build with BuildKit
  registry cache (`--cache-from=:cache --cache-to=type=inline`). The cache
  tag persists per repository so subsequent builds reuse layers.
- **Cloud Run rollout** — Cloud Run waits for at least one healthy revision
  before shifting traffic. Min instances = 1 on production keeps a warm pod.
- **Smoke tests** — health, auth, discovery, web-consent, and DCR handoff checks with 15 s timeouts.
- **EAS build** — `deploy:mobile` queues it after Pulumi succeeds and returns
  once the build is *queued* on Expo's infra. Actual ipa/aab build takes 15–30 min
  on Expo's side and posts to TestFlight / Play when done.

### Knobs

- `npm run deploy` — web/API only; mobile is skipped.
- `npm run deploy:mobile` — queue the production iOS build after web/API succeed.
- `pulumi up -c niftygifty:sourceSha=<sha>` — roll an image tag that already
  exists (useful for rollback; direct Pulumi does not build it).

### Rollback

Cloud Run keeps prior revisions, and schema migrations are expand-compatible. A rollback to a revision that predates OAuth credential version 2 requires a maintenance window: legacy code does not understand the v2 provenance column and could re-accept a surviving credential. Do not run the revocation task while OAuth issuance is live.

First roll the current v2 API with issuance disabled, verify the maintenance response, and wait for the old revision's 300-second maximum request lifetime to drain:

```bash
gcloud run services update listygifty-api-prod \
  --project=listygifty --region=us-central1 \
  --update-env-vars=OAUTH_ISSUANCE_ENABLED=false

curl -i "https://api.listygifty.com/oauth/authorize"  # must be HTTP 503
sleep 300
```

Then revoke all OAuth credentials from the still-current migration-job image. The explicit confirmation variable prevents accidental use without this quiescence step:

```bash
gcloud run jobs execute listygifty-migrate-prod \
  --project=listygifty --region=us-central1 --wait \
  --update-env-vars=OAUTH_ROLLBACK_QUIESCED=true \
  --args=exec,rails,oauth:revoke_all_for_legacy_rollback
```

This intentionally disconnects OAuth clients; break-glass admin API keys are unaffected. Immediately choose one rollback path below. If the rollback is abandoned, restore the current v2 release (and `OAUTH_ISSUANCE_ENABLED=true`) before ending maintenance.

**Pulumi-driven (preserves IaC truth and rolls web before API):**

`sourceSha` is an Artifact Registry image tag, not an arbitrary 40-character Git SHA. Recover the exact prior tag (normally the 12-character or `*-dirty` value recorded as `deployedSha`) from deployment output or the previous Cloud Run revision image before rollback:

```bash
cd infra/pulumi
pulumi stack output deployedSha --stack production  # current recorded image tag

gcloud run revisions describe <previous-api-revision> \
  --project=listygifty --region=us-central1 \
  --format='value(spec.containers[0].image)'
# Copy the exact tag after the final colon and verify both API and web images exist.

pulumi up --stack production \
  -c niftygifty:sourceSha=<previous-image-tag> \
  -c niftygifty:legacyRollback=true
# The legacy flag skips only OAuth-v2 discovery/consent/DCR assertions;
# baseline API health, auth, queue-worker, and web checks still run.
pulumi config set niftygifty:legacyRollback false --stack production
git -C ../.. restore infra/pulumi/Pulumi.production.yaml
```

**Fast manual (out-of-band; update both services to compatible revisions):**
```bash
gcloud run services update-traffic listygifty-web-prod \
  --project=listygifty --region=us-central1 --to-revisions=<previous-web-revision>=100
gcloud run services update-traffic listygifty-api-prod \
  --project=listygifty --region=us-central1 --to-revisions=<previous-api-revision>=100
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

After that, only `npm run deploy:mobile` fires `eas build --auto-submit`.
The ordinary `npm run deploy` path intentionally skips mobile. The build runs
on Expo's infrastructure (15–30 min) and TestFlight / App Store ingestion
follows.
