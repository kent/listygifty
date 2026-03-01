#!/bin/bash
# GCP Setup Script for ListyGifty
# Run this script to set up the GCP infrastructure for staging and production

set -e

# Configuration
PROJECT_ID="listygifty"
REGION="us-central1"
ARTIFACT_REPO="listygifty"

echo "Setting up GCP infrastructure for ListyGifty..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"

# Set project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "Enabling required APIs..."
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com \
    sqladmin.googleapis.com \
    cloudresourcemanager.googleapis.com

# Create Artifact Registry repository
echo "Creating Artifact Registry repository..."
gcloud artifacts repositories create $ARTIFACT_REPO \
    --repository-format=docker \
    --location=$REGION \
    --description="ListyGifty Docker images" \
    || echo "Repository already exists"

# Create Cloud SQL instance (if not exists)
echo "Creating Cloud SQL instance..."
gcloud sql instances describe listygifty-db-prod >/dev/null 2>&1 || \
gcloud sql instances create listygifty-db-prod \
    --database-version=POSTGRES_16 \
    --tier=db-f1-micro \
    --region=$REGION \
    --storage-type=SSD \
    --storage-size=10GB \
    --backup \
    --backup-start-time=03:00

# Create databases
echo "Creating databases..."
gcloud sql databases create listygifty_staging --instance=listygifty-db-prod || echo "Staging database exists"
gcloud sql databases create listygifty_production --instance=listygifty-db-prod || echo "Production database exists"

# Create database user
echo "Creating database user..."
DB_PASSWORD=$(openssl rand -base64 32)
gcloud sql users create listygifty --instance=listygifty-db-prod --password="$DB_PASSWORD" || echo "User exists"

# Store secrets
echo "Setting up Secret Manager..."

# Helper function to create or update secret
create_or_update_secret() {
    local name=$1
    local value=$2

    if gcloud secrets describe $name >/dev/null 2>&1; then
        echo "$value" | gcloud secrets versions add $name --data-file=-
    else
        echo "$value" | gcloud secrets create $name --data-file=- --replication-policy=automatic
    fi
}

echo "Creating secrets (you may need to update these values)..."
echo "Please update the following secrets manually:"
echo "  - listygifty-db-staging"
echo "  - listygifty-db-prod"
echo "  - listygifty-rails-key-staging"
echo "  - listygifty-rails-key-prod"
echo "  - listygifty-clerk-key-staging"
echo "  - listygifty-clerk-key-prod"
echo "  - listygifty-stripe-key-prod"
echo "  - listygifty-postmark-key-prod"
echo "  - listygifty-openai-key-prod"
echo "  - listygifty-posthog-key-prod"

# Create placeholder secrets (replace with actual values)
for secret in listygifty-db-staging listygifty-db-prod listygifty-rails-key-staging listygifty-rails-key-prod listygifty-clerk-key-staging listygifty-clerk-key-prod; do
    gcloud secrets describe $secret >/dev/null 2>&1 || \
    echo "PLACEHOLDER" | gcloud secrets create $secret --data-file=- --replication-policy=automatic
done

# Grant Cloud Run access to secrets
echo "Granting Cloud Run access to secrets..."
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
COMPUTE_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

for secret in listygifty-db-staging listygifty-db-prod listygifty-rails-key-staging listygifty-rails-key-prod listygifty-clerk-key-staging listygifty-clerk-key-prod; do
    gcloud secrets add-iam-policy-binding $secret \
        --member="serviceAccount:$COMPUTE_SA" \
        --role="roles/secretmanager.secretAccessor" \
        || true
done

# Create Cloud Build trigger for staging
echo "Creating Cloud Build trigger..."
gcloud builds triggers create github \
    --name="listygifty-staging" \
    --repo-name="listygifty" \
    --repo-owner="$GITHUB_OWNER" \
    --branch-pattern="^main$" \
    --build-config="deploy/cloudbuild.yaml" \
    || echo "Trigger exists or GitHub not connected"

# Create migration job
echo "Creating migration Cloud Run job..."
cat > /tmp/migrate-job.yaml << 'EOF'
apiVersion: run.googleapis.com/v1
kind: Job
metadata:
  name: listygifty-migrate-prod
spec:
  template:
    spec:
      template:
        spec:
          containers:
            - image: us-central1-docker.pkg.dev/listygifty/listygifty/listygifty-api:latest
              command:
                - bundle
                - exec
                - rails
                - db:migrate
              env:
                - name: RAILS_ENV
                  value: production
          serviceAccountName: default
EOF

gcloud run jobs replace /tmp/migrate-job.yaml --region=$REGION || echo "Will create job on first deployment"

echo ""
echo "=========================================="
echo "GCP Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Update secrets with actual values:"
echo "   gcloud secrets versions add listygifty-db-prod --data-file=- <<< 'postgres://user:pass@host/db'"
echo ""
echo "2. Connect GitHub repository to Cloud Build:"
echo "   Visit: https://console.cloud.google.com/cloud-build/triggers/connect"
echo ""
echo "3. Deploy manually for the first time:"
echo "   cd apps/api && gcloud run deploy listygifty-api-staging --source ."
echo ""
echo "4. Set up custom domains:"
echo "   gcloud run domain-mappings create --service listygifty-api --domain api.listygifty.com"
echo "   gcloud run domain-mappings create --service listygifty-api-staging --domain api-staging.listygifty.com"
