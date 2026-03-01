# Claude Deployment Notes

## Canonical GCP Target

- Project ID: `listygifty`
- Project number: `906707282968`
- Region: `us-central1`

## gcloud Configuration Profile

A named gcloud configuration `listygifty` is set up to avoid account/project switching issues:

```bash
# Activate the listygifty profile before running gcloud commands
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

## Standard Deploy Commands

```bash
# API
ENVIRONMENT=staging HEROKU_SECRET_BINDINGS_FILE=infra/gcp/secret-bindings.staging.env bash infra/gcp/scripts/deploy-api.sh
ENVIRONMENT=production HEROKU_SECRET_BINDINGS_FILE=infra/gcp/secret-bindings.production.env bash infra/gcp/scripts/deploy-api.sh

# Web
ENVIRONMENT=staging HEROKU_SECRET_BINDINGS_FILE=infra/gcp/secret-bindings.staging.env bash infra/gcp/scripts/deploy-web.sh
ENVIRONMENT=production HEROKU_SECRET_BINDINGS_FILE=infra/gcp/secret-bindings.production.env bash infra/gcp/scripts/deploy-web.sh
```
