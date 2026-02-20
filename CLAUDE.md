# Claude Deployment Notes

## Canonical GCP Target

- Project ID: `listygifty`
- Project number: `906707282968`
- Region: `us-east1`

## Deployment Identity

- Service account: `niftygifty-deployer@listygifty.iam.gserviceaccount.com`
- Local credentials file (gitignored): `.gcp/keys/listygifty-deployer.json`
- Local deploy profile (gitignored): `.gcp/listygifty-deploy.env`

## Always Run Before Any Deploy Command

```bash
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
