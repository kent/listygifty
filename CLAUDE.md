# Claude Deployment Notes

## Canonical GCP Target

- Project ID: `listygifty`
- Project number: `906707282968`
- Region: `us-central1`

## gcloud Configuration Profile

A named gcloud configuration `listygifty` is set up to avoid account/project switching issues:

```bash
gcloud config configurations activate listygifty
```

This profile is configured with:
- Account: `kent.fenwick@gmail.com`
- Project: `listygifty`

## Deployment Identity

- Service account: `niftygifty-deployer@listygifty.iam.gserviceaccount.com`
- GitHub Actions SA: `github-actions@listygifty.iam.gserviceaccount.com`
- Local credentials file (gitignored): `.gcp/keys/listygifty-deployer.json`
- Local deploy profile (gitignored): `.gcp/listygifty-deploy.env`

## Always Run Before Any Deploy Command

```bash
gcloud config configurations activate listygifty
source .gcp/listygifty-deploy.env
```

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
