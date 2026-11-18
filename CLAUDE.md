# Claude Deployment Notes

## Canonical GCP Target

- Project ID: `listygifty`
- Project number: `906707282968`
- Region: `us-central1`

## gcloud Account Pinning

This machine has several gcloud configurations, and the globally active one
can change at any time. Never rely on it, and never `gcloud config
configurations activate` or `gcloud config set account` to fix it. The repo
pins gcloud with `CLOUDSDK_*` environment variables, which override whatever
configuration is active:

- Claude Code sessions: `env` in `.claude/settings.json`
- Your shell: `.envrc` (direnv; run `direnv allow` once)
- Every infra script and `npm run deploy`: `infra/gcp/scripts/gcloud-pin.sh`

All three pin account `kent.fenwick@gmail.com`, project `listygifty`, region
`us-central1`. If a gcloud command reports a different account, the pin
isn't loaded; pass `--account kent.fenwick@gmail.com --project listygifty`
explicitly rather than changing global config.

## Deployment Identity

- Service account: `niftygifty-deployer@listygifty.iam.gserviceaccount.com`
- GitHub Actions SA: `github-actions@listygifty.iam.gserviceaccount.com`
- Local credentials file (gitignored): `.gcp/keys/listygifty-deployer.json`
- Local deploy profile (gitignored): `.gcp/listygifty-deploy.env`

## Before Any Deploy Command

`npm run deploy` pins the gcloud account and project itself and sources
`.gcp/listygifty-deploy.env` when that file exists, so no setup is needed
beyond having credentials for the account (`gcloud auth login
kent.fenwick@gmail.com`). Merging to `main` also deploys through
`.github/workflows/deploy.yml`.

## Deploys

Everything ships through Pulumi. Production only — staging is turned off
pre-PMF (stack destroyed 2026-07-30; see `infra/pulumi/README.md` to
re-enable). Tests run locally (`npm test`), never in the deploy path.

```bash
npm run deploy              # build → roll → migrate → smoke (production)
npm run deploy:mobile       # same, plus queue the iOS EAS build
```

The iOS EAS build is opt-in (`ENABLE_MOBILE=true` or `deploy:mobile`).

Pulumi state lives in `gs://listygifty-pulumi-state` (self-hosted GCS backend).
The `infra/pulumi/` directory is the single source of truth for Cloud Run
services, IAM, Secret Manager containers, the migration job, domain mappings,
and EAS build orchestration.

Operational utilities (one-time bootstrap, secret rotation, ad-hoc DB ops)
remain in `infra/gcp/scripts/` and `npm run infra:*`:

```bash
npm run infra:bootstrap        # one-time GCP project bootstrap
npm run infra:sync-secrets     # push secret values into Secret Manager
npm run infra:migrate-db       # run DB migrations out of band
npm run infra:verify-db        # validate prod DB counts
```

See `infra/pulumi/README.md` for the full deployment architecture, bootstrap
steps, and rollback procedure.
