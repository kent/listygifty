#!/usr/bin/env bash
# Pin gcloud to the listygifty project and account for this process, whatever
# configuration is active globally on the machine. CLOUDSDK_* environment
# variables override the active gcloud configuration, so another project's
# config (or a mid-session `gcloud config set account`) can't redirect a
# deploy or DB operation.
#
# Sourced by lib.sh and deploy.sh. Values already in the environment win, so
# .gcp/listygifty-deploy.env and one-off overrides still apply. Set
# LISTYGIFTY_GCLOUD_ACCOUNT to use a different account. In GitHub Actions the
# account comes from workload identity, so only the project is pinned.

LISTYGIFTY_GCP_PROJECT="listygifty"
LISTYGIFTY_GCP_REGION="us-central1"
LISTYGIFTY_GCLOUD_ACCOUNT="${LISTYGIFTY_GCLOUD_ACCOUNT:-kent.fenwick@gmail.com}"

export CLOUDSDK_CORE_PROJECT="${CLOUDSDK_CORE_PROJECT:-${LISTYGIFTY_GCP_PROJECT}}"
export CLOUDSDK_COMPUTE_REGION="${CLOUDSDK_COMPUTE_REGION:-${LISTYGIFTY_GCP_REGION}}"
export CLOUDSDK_RUN_REGION="${CLOUDSDK_RUN_REGION:-${LISTYGIFTY_GCP_REGION}}"

if [[ -z "${GITHUB_ACTIONS:-}" ]]; then
  export CLOUDSDK_CORE_ACCOUNT="${CLOUDSDK_CORE_ACCOUNT:-${LISTYGIFTY_GCLOUD_ACCOUNT}}"

  if ! gcloud auth list --format='value(account)' 2>/dev/null | grep -qxF "${CLOUDSDK_CORE_ACCOUNT}"; then
    echo "gcloud has no credentials for ${CLOUDSDK_CORE_ACCOUNT}." >&2
    echo "Run: gcloud auth login ${CLOUDSDK_CORE_ACCOUNT}" >&2
    exit 1
  fi
fi
