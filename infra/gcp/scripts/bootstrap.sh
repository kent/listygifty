#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/gcp/scripts/lib.sh
source "${SCRIPT_DIR}/lib.sh"

require_cmd gcloud
require_cmd openssl
require_cmd rg

ENVIRONMENT="$(resolve_environment "${ENVIRONMENT:-production}")"
ENV_SUFFIX="$(environment_suffix "${ENVIRONMENT}")"
DB_SUFFIX="$(environment_db_suffix "${ENVIRONMENT}")"
SECRET_PREFIX="${SECRET_PREFIX:-$(default_secret_prefix "${ENVIRONMENT}")}"

PROJECT_ID="${PROJECT_ID:-listygifty}"
REGION="${REGION:-us-east1}"
ARTIFACT_REGION="${ARTIFACT_REGION:-${REGION}}"
ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-niftygifty}"
SQL_INSTANCE="${SQL_INSTANCE:-niftygifty-postgres}"
SQL_DB_VERSION="${SQL_DB_VERSION:-POSTGRES_17}"
SQL_EDITION="${SQL_EDITION:-ENTERPRISE}"
SQL_TIER="${SQL_TIER:-db-f1-micro}"
SQL_STORAGE_GB="${SQL_STORAGE_GB:-10}"
SQL_DB_NAME="${SQL_DB_NAME:-niftygifty${DB_SUFFIX}}"
if [[ "${ENVIRONMENT}" == "production" ]]; then
  default_sql_db_user="niftygifty"
  default_runtime_sa_name="niftygifty-runner"
else
  default_sql_db_user="niftygifty_${ENVIRONMENT}"
  default_runtime_sa_name="niftygifty${ENV_SUFFIX}-runner"
fi
SQL_DB_USER="${SQL_DB_USER:-${default_sql_db_user}}"
RUNTIME_SERVICE_ACCOUNT_NAME="${RUNTIME_SERVICE_ACCOUNT_NAME:-${default_runtime_sa_name}}"
RUNTIME_SERVICE_ACCOUNT_EMAIL="${RUNTIME_SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SECRET_DB_PASSWORD="${SECRET_DB_PASSWORD:-${SECRET_PREFIX}db-password}"
SECRET_DATABASE_URL="${SECRET_DATABASE_URL:-${SECRET_PREFIX}database-url}"

log "Using PROJECT_ID=${PROJECT_ID}, REGION=${REGION}, ENVIRONMENT=${ENVIRONMENT}"

log "Enabling required Google Cloud APIs"
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  compute.googleapis.com \
  iam.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  sqladmin.googleapis.com \
  --project="${PROJECT_ID}" >/dev/null

log "Ensuring Artifact Registry repository ${ARTIFACT_REPOSITORY} (${ARTIFACT_REGION}) exists"
if ! gcloud artifacts repositories describe "${ARTIFACT_REPOSITORY}" \
  --project="${PROJECT_ID}" \
  --location="${ARTIFACT_REGION}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${ARTIFACT_REPOSITORY}" \
    --project="${PROJECT_ID}" \
    --location="${ARTIFACT_REGION}" \
    --repository-format=docker \
    --description="NiftyGifty application images" >/dev/null
fi

log "Ensuring runtime service account ${RUNTIME_SERVICE_ACCOUNT_EMAIL} exists"
if ! gcloud iam service-accounts describe "${RUNTIME_SERVICE_ACCOUNT_EMAIL}" \
  --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${RUNTIME_SERVICE_ACCOUNT_NAME}" \
    --project="${PROJECT_ID}" \
    --display-name="NiftyGifty Cloud Run runtime" >/dev/null
fi

# IAM propagation for newly created service accounts can be slightly delayed.
for _ in {1..20}; do
  if gcloud iam service-accounts describe "${RUNTIME_SERVICE_ACCOUNT_EMAIL}" \
    --project="${PROJECT_ID}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

for role in roles/cloudsql.client roles/secretmanager.secretAccessor roles/logging.logWriter roles/artifactregistry.reader; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT_EMAIL}" \
    --role="${role}" >/dev/null
 done

PROJECT_NUMBER="$(project_number "${PROJECT_ID}")"
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

for role in roles/artifactregistry.writer roles/run.admin; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${CLOUD_BUILD_SA}" \
    --role="${role}" >/dev/null
 done

gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SERVICE_ACCOUNT_EMAIL}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/iam.serviceAccountUser" >/dev/null

log "Ensuring Cloud SQL instance ${SQL_INSTANCE} exists"
if ! gcloud sql instances describe "${SQL_INSTANCE}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud sql instances create "${SQL_INSTANCE}" \
    --project="${PROJECT_ID}" \
    --database-version="${SQL_DB_VERSION}" \
    --edition="${SQL_EDITION}" \
    --tier="${SQL_TIER}" \
    --region="${REGION}" \
    --storage-size="${SQL_STORAGE_GB}" \
    --storage-auto-increase \
    --backup-start-time=03:00 >/dev/null
fi

log "Ensuring Cloud SQL database ${SQL_DB_NAME} exists"
if ! gcloud sql databases describe "${SQL_DB_NAME}" \
  --project="${PROJECT_ID}" \
  --instance="${SQL_INSTANCE}" >/dev/null 2>&1; then
  gcloud sql databases create "${SQL_DB_NAME}" \
    --project="${PROJECT_ID}" \
    --instance="${SQL_INSTANCE}" >/dev/null
fi

if gcloud secrets describe "${SECRET_DB_PASSWORD}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  DB_PASSWORD="$(gcloud secrets versions access latest --project="${PROJECT_ID}" --secret="${SECRET_DB_PASSWORD}")"
else
  DB_PASSWORD="$(openssl rand -hex 24)"
  upsert_secret "${PROJECT_ID}" "${SECRET_DB_PASSWORD}" "${DB_PASSWORD}"
fi

if gcloud sql users list --project="${PROJECT_ID}" --instance="${SQL_INSTANCE}" --format='value(name)' | rg -qx "${SQL_DB_USER}"; then
  gcloud sql users set-password "${SQL_DB_USER}" \
    --project="${PROJECT_ID}" \
    --instance="${SQL_INSTANCE}" \
    --password="${DB_PASSWORD}" >/dev/null
else
  gcloud sql users create "${SQL_DB_USER}" \
    --project="${PROJECT_ID}" \
    --instance="${SQL_INSTANCE}" \
    --password="${DB_PASSWORD}" >/dev/null
fi

INSTANCE_CONNECTION_NAME="$(gcloud sql instances describe "${SQL_INSTANCE}" --project="${PROJECT_ID}" --format='value(connectionName)')"
DATABASE_URL="postgresql://${SQL_DB_USER}:${DB_PASSWORD}@localhost/${SQL_DB_NAME}?host=/cloudsql/${INSTANCE_CONNECTION_NAME}&pool=5"
upsert_secret "${PROJECT_ID}" "${SECRET_DATABASE_URL}" "${DATABASE_URL}"

log "Bootstrap complete"
cat <<SUMMARY

Environment:          ${ENVIRONMENT}
Project:              ${PROJECT_ID}
Region:               ${REGION}
Artifact Repository:  ${ARTIFACT_REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPOSITORY}
Cloud SQL Instance:   ${SQL_INSTANCE}
Cloud SQL Conn Name:  ${INSTANCE_CONNECTION_NAME}
DB Name/User:         ${SQL_DB_NAME}/${SQL_DB_USER}
Runtime Service Acct: ${RUNTIME_SERVICE_ACCOUNT_EMAIL}
DB Secrets:           ${SECRET_DB_PASSWORD}, ${SECRET_DATABASE_URL}

SUMMARY
