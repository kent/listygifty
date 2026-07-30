import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as command from "@pulumi/command";

// =============================================================================
// Configuration
// =============================================================================

const gcpConfig = new pulumi.Config("gcp");
const nfg = new pulumi.Config("niftygifty");

const project = gcpConfig.require("project");
const region = gcpConfig.require("region");
const environment = nfg.require("environment") as "staging" | "production";

const apiServiceName = nfg.require("apiService");
const webServiceName = nfg.require("webService");
const migrationJobName = nfg.require("migrationJob");
const webSaName = nfg.require("webServiceAccountName");
const secretPrefix = nfg.require("secretPrefix");
const railsKeySecretName = nfg.require("railsKeySecret");
const appDomain = nfg.require("appDomain");
const apiDomain = nfg.require("apiDomain");
const wwwDomain = nfg.get("wwwDomain") ?? "";
const apiMinInstances = Number(nfg.require("apiMinInstances"));
const apiMaxInstances = Number(nfg.require("apiMaxInstances"));
const webMinInstances = Number(nfg.require("webMinInstances"));
const webMaxInstances = Number(nfg.require("webMaxInstances"));
const apiConcurrency = Number(nfg.get("apiConcurrency") ?? "10");
const webConcurrency = Number(nfg.get("webConcurrency") ?? "80");
const apiPort = Number(nfg.require("apiPort"));
const webPort = Number(nfg.require("webPort"));
const sqlInstanceName = nfg.require("sqlInstance");
const imageRegistry = nfg.require("imageRegistry");
const apiImageRepo = nfg.require("apiImageRepo");
const webImageRepo = nfg.require("webImageRepo");
const androidAppLinkSha256CertFingerprints =
  nfg.get("androidAppLinkSha256CertFingerprints") ?? "";

// Source SHA — set by the deploy wrapper. Drives image tags; same SHA twice
// is a no-op redeploy. Required so the program is honest about which commit
// is rolling out.
const sourceSha = nfg.require("sourceSha");

// =============================================================================
// Provider
// =============================================================================

const provider = new gcp.Provider("listygifty", { project, region });
const providerOpts = { provider };

// =============================================================================
// Service accounts
// =============================================================================
//
// The API services run on the default compute SA (legacy choice — kept so
// Pulumi doesn't trigger an unnecessary change). Only the web services use
// the dedicated niftygifty-runner / niftygifty-staging-runner SAs.

const defaultComputeSa = pulumi.interpolate`906707282968-compute@developer.gserviceaccount.com`;

const webSa = new gcp.serviceaccount.Account(
  "web-sa",
  {
    accountId: webSaName,
    displayName: `niftygifty web Cloud Run runtime (${environment})`,
  },
  {
    ...providerOpts,
    protect: true,
    // The deployer SA has create/get on IAM service accounts but not update.
    // Ignore description / displayName drift so the program doesn't try to
    // mutate metadata it can't write.
    ignoreChanges: ["displayName", "description"],
  }
);

const webSaEmail = webSa.email;

// =============================================================================
// Secret Manager — containers + runtime IAM
// =============================================================================
//
// Pulumi owns the *declaration* of each secret (replication, labels,
// protection). Values continue to be rotated out-of-band via gcloud or
// infra/gcp/scripts/sync-heroku-secrets.sh — raw values intentionally
// don't live in IaC state.

const apiSecretSlugs = [
  "database-url",
  "clerk-secret-key",
  "stripe-secret-key",
  "stripe-webhook-secret",
  "postmark-api-token",
  "openai-api-key",
  "allowed-hosts",
  "cors-origins",
  "frontend-url",
];

const webSecretSlugs = [
  "clerk-secret-key",
  "app-base",
  "stripe-public-key",
];

// Union of slugs used as Secret Manager containers we manage. The rails key
// secret (listygifty-rails-key-{env}) is named differently from the others
// and is handled separately below.
const allSlugs = Array.from(new Set([...apiSecretSlugs, ...webSecretSlugs]));

const secretByFullName = new Map<string, gcp.secretmanager.Secret>();

function declareSecret(fullName: string, _description: string) {
  const slug = fullName.replace(/[^a-z0-9]+/g, "-");
  const resource = new gcp.secretmanager.Secret(
    `secret-${slug}`,
    {
      secretId: fullName,
      replication: { auto: {} },
    },
    {
      ...providerOpts,
      protect: true,
      retainOnDelete: true,
      // The deployer SA has secretAccessor + viewer, not admin. Ignore label
      // / annotation drift so Pulumi doesn't try to mutate metadata it can't
      // write. Secret values are still rotated out-of-band via gcloud.
      ignoreChanges: ["labels", "annotations"],
    }
  );
  secretByFullName.set(fullName, resource);
  return resource;
}

allSlugs.forEach((slug) => declareSecret(`${secretPrefix}${slug}`, `${slug} for ${environment}`));
declareSecret(railsKeySecretName, `Rails secret key base for ${environment}`);

// Per-secret IAM bindings are intentionally NOT managed by Pulumi. The
// deployer SA has secretAccessor (read) but not secretAdmin (setIamPolicy),
// and the existing bindings work (Cloud Run services successfully read every
// secret today). If we ever need to grant new accessor permissions, do it
// via gcloud or the GCP console.

// =============================================================================
// Cloud SQL — referenced read-only
// =============================================================================

const sqlInstance = gcp.sql.DatabaseInstance.get(
  "sql-instance",
  sqlInstanceName,
  undefined,
  providerOpts
);

// =============================================================================
// Active Storage
// =============================================================================

const activeStorageBucket = new gcp.storage.Bucket(
  "active-storage-bucket",
  {
    name: `${project}-active-storage-${environment}`,
    location: region.toUpperCase(),
    uniformBucketLevelAccess: true,
    publicAccessPrevention: "enforced",
    versioning: { enabled: true },
  },
  {
    ...providerOpts,
    protect: environment === "production",
  }
);

new gcp.storage.BucketIAMMember(
  "active-storage-api-object-admin",
  {
    bucket: activeStorageBucket.name,
    role: "roles/storage.objectAdmin",
    member: pulumi.interpolate`serviceAccount:${defaultComputeSa}`,
  },
  providerOpts
);

// =============================================================================
// Image URIs (built by Cloud Build / GHA — Pulumi consumes them)
// =============================================================================

const apiImageUri = `${imageRegistry}/${apiImageRepo}:${sourceSha}`;
const webImageUri = `${imageRegistry}/${webImageRepo}:${sourceSha}`;

// =============================================================================
// Helpers for env binding shapes
// =============================================================================

function secretEnv(envVar: string, fullSecretName: string) {
  return {
    name: envVar,
    valueSource: {
      secretKeyRef: {
        secret: fullSecretName,
        version: "latest",
      },
    },
  };
}

function plainEnv(name: string, value: pulumi.Input<string>) {
  return { name, value };
}

// =============================================================================
// Cloud Run: API
// =============================================================================

const apiEnv: pulumi.Input<pulumi.Input<gcp.types.input.cloudrunv2.ServiceTemplateContainerEnv>[]> = [
  plainEnv("RAILS_ENV", environment === "production" ? "production" : "staging"),
  plainEnv("RAILS_MAX_THREADS", "5"),
  plainEnv("RAILS_MIN_THREADS", "5"),
  // Cloud Run has no separate long-running worker service. Keep Solid Queue
  // attached to Puma so queued mail and other background jobs are processed.
  plainEnv("SOLID_QUEUE_IN_PUMA", "true"),
  plainEnv("GOOGLE_CLOUD_PROJECT", project),
  plainEnv("ACTIVE_STORAGE_SERVICE", "google"),
  plainEnv("ACTIVE_STORAGE_BUCKET", activeStorageBucket.name),
  secretEnv("DATABASE_URL", `${secretPrefix}database-url`),
  secretEnv("SECRET_KEY_BASE", railsKeySecretName),
  secretEnv("ALLOWED_HOSTS", `${secretPrefix}allowed-hosts`),
  secretEnv("CLERK_SECRET_KEY", `${secretPrefix}clerk-secret-key`),
  secretEnv("STRIPE_SECRET_KEY", `${secretPrefix}stripe-secret-key`),
  secretEnv("STRIPE_WEBHOOK_SECRET", `${secretPrefix}stripe-webhook-secret`),
  secretEnv("POSTMARK_API_TOKEN", `${secretPrefix}postmark-api-token`),
  secretEnv("OPENAI_API_KEY", `${secretPrefix}openai-api-key`),
  secretEnv("CORS_ORIGINS", `${secretPrefix}cors-origins`),
  secretEnv("FRONTEND_URL", `${secretPrefix}frontend-url`),
];

const apiServiceResource = new gcp.cloudrunv2.Service(
  "api-service",
  {
    name: apiServiceName,
    location: region,
    ingress: "INGRESS_TRAFFIC_ALL",
    deletionProtection: environment === "production",
    template: {
      serviceAccount: defaultComputeSa,
      timeout: "300s",
      maxInstanceRequestConcurrency: apiConcurrency,
      scaling: {
        minInstanceCount: apiMinInstances,
        maxInstanceCount: apiMaxInstances,
      },
      containers: [
        {
          image: apiImageUri,
          ports: { containerPort: apiPort },
          // Puma also supervises Solid Queue in this service. Rails plus the
          // dispatcher, worker, and scheduler exceeds 512 MiB during normal
          // mail delivery and was repeatedly OOM-killed in production.
          resources: { limits: { cpu: "1", memory: "1Gi" }, cpuIdle: false },
          envs: apiEnv,
        },
      ],
      volumes: [
        {
          name: "cloudsql",
          cloudSqlInstance: { instances: [sqlInstance.connectionName] },
        },
      ],
    },
    traffics: [{ type: "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST", percent: 100 }],
  },
  providerOpts
);

new gcp.cloudrunv2.ServiceIamMember(
  "api-public",
  {
    project,
    location: region,
    name: apiServiceResource.name,
    role: "roles/run.invoker",
    member: "allUsers",
  },
  providerOpts
);

// =============================================================================
// Cloud Run: Web
// =============================================================================

const webEnv: pulumi.Input<pulumi.Input<gcp.types.input.cloudrunv2.ServiceTemplateContainerEnv>[]> = [
  plainEnv("NODE_ENV", "production"),
  plainEnv("NEXT_TELEMETRY_DISABLED", "1"),
  plainEnv("NEXT_PUBLIC_APP_URL", `https://${appDomain}`),
  plainEnv("NEXT_PUBLIC_API_URL", `https://${apiDomain}`),
  plainEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_live_Y2xlcmsubGlzdHlnaWZ0eS5jb20k"),
  plainEnv("NEXT_PUBLIC_CLERK_SIGN_IN_URL", "/login"),
  plainEnv("NEXT_PUBLIC_CLERK_SIGN_UP_URL", "/signup"),
  plainEnv("NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL", "/dashboard"),
  plainEnv("NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL", "/dashboard"),
  plainEnv("NEXT_PUBLIC_POSTHOG_KEY", ""),
  plainEnv("NEXT_PUBLIC_POSTHOG_HOST", ""),
  plainEnv("ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS", androidAppLinkSha256CertFingerprints),
  secretEnv("CLERK_SECRET_KEY", `${secretPrefix}clerk-secret-key`),
  secretEnv("APP_BASE", `${secretPrefix}app-base`),
  secretEnv("STRIPE_PUBLIC_KEY", `${secretPrefix}stripe-public-key`),
];

const webServiceResource = new gcp.cloudrunv2.Service(
  "web-service",
  {
    name: webServiceName,
    location: region,
    ingress: "INGRESS_TRAFFIC_ALL",
    deletionProtection: environment === "production",
    template: {
      serviceAccount: webSaEmail,
      timeout: "300s",
      maxInstanceRequestConcurrency: webConcurrency,
      scaling: {
        minInstanceCount: webMinInstances,
        maxInstanceCount: webMaxInstances,
      },
      containers: [
        {
          image: webImageUri,
          ports: { containerPort: webPort },
          resources: { limits: { cpu: "1", memory: "512Mi" }, cpuIdle: false },
          envs: webEnv,
        },
      ],
    },
    traffics: [{ type: "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST", percent: 100 }],
  },
  providerOpts
);

new gcp.cloudrunv2.ServiceIamMember(
  "web-public",
  {
    project,
    location: region,
    name: webServiceResource.name,
    role: "roles/run.invoker",
    member: "allUsers",
  },
  providerOpts
);

// =============================================================================
// Migration job — db:migrate runs after API service updates
// =============================================================================

const migrationJobResource = new gcp.cloudrunv2.Job(
  "api-migrate",
  {
    name: migrationJobName,
    location: region,
    template: {
      taskCount: 1,
      template: {
        serviceAccount: defaultComputeSa,
        timeout: "300s",
        maxRetries: 0,
        containers: [
          {
            image: apiImageUri,
            commands: ["bundle"],
            args: ["exec", "rails", "db:migrate"],
            resources: { limits: { cpu: "1", memory: "512Mi" } },
            envs: [
              plainEnv("RAILS_ENV", environment === "production" ? "production" : "staging"),
              plainEnv("GOOGLE_CLOUD_PROJECT", project),
              plainEnv("ACTIVE_STORAGE_SERVICE", "google"),
              plainEnv("ACTIVE_STORAGE_BUCKET", activeStorageBucket.name),
              secretEnv("DATABASE_URL", `${secretPrefix}database-url`),
              secretEnv("SECRET_KEY_BASE", railsKeySecretName),
              secretEnv("CLERK_SECRET_KEY", `${secretPrefix}clerk-secret-key`),
            ],
          },
        ],
        volumes: [
          {
            name: "cloudsql",
            cloudSqlInstance: { instances: [sqlInstance.connectionName] },
          },
        ],
      },
    },
  },
  providerOpts
);

const runMigrations = new command.local.Command(
  "run-migrations",
  {
    create: pulumi.interpolate`gcloud run jobs execute ${migrationJobName} \
      --project=${project} --region=${region} --wait`,
    triggers: [sourceSha],
    environment: { CLOUDSDK_CORE_PROJECT: project },
  },
  { dependsOn: [migrationJobResource, apiServiceResource] }
);

// =============================================================================
// Domain mappings
// =============================================================================
//
// Domain mappings are explicitly NOT managed by Pulumi for now. They're
// stable, set-and-forget, and Pulumi's `certificateMode` handling triggers
// a destructive replace cycle on the existing imported resources. They were
// created out-of-band and continue to be reviewed via gcloud. If they need
// changes, prefer `gcloud beta run domain-mappings ...` over re-introducing
// them here.

// =============================================================================
// Smoke tests — fail the rollout if the new revision can't serve traffic
// =============================================================================

new command.local.Command(
  "smoke-tests",
  {
    create: pulumi.interpolate`bash -c '
set -e
api_url="$(gcloud run services describe ${apiServiceName} --project=${project} --region=${region} --format="value(status.url)")"
web_url="$(gcloud run services describe ${webServiceName} --project=${project} --region=${region} --format="value(status.url)")"
queue_worker="$(gcloud run services describe ${apiServiceName} --project=${project} --region=${region} --format="yaml(spec.template.spec.containers[0].env)" | grep -A1 "name: SOLID_QUEUE_IN_PUMA" | grep -c "value: .true.")"
[ "$queue_worker" = "1" ] || { echo "FAIL: Solid Queue worker is not enabled" >&2; exit 1; }
echo "  ✓ Solid Queue worker enabled"
check() {
  code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$2")"
  [ "$code" = "$3" ] || { echo "FAIL: $1 expected $3 got $code ($2)" >&2; exit 1; }
  echo "  ✓ $1 ($code)"
}
check "API /up"      "$api_url/up"    200
check "API /holidays" "$api_url/holidays" 401
check "web /"        "$web_url/"      200
check "web /login"   "$web_url/login" 200
'`,
    triggers: [sourceSha],
  },
  { dependsOn: [runMigrations, webServiceResource] }
);

// =============================================================================
// Outputs
// =============================================================================

export const apiUrl = apiServiceResource.uri;
export const webUrl = webServiceResource.uri;
export const apiImage = apiImageUri;
export const webImage = webImageUri;
export const deployedSha = sourceSha;
export const sqlConnectionName = sqlInstance.connectionName;

export function buildStack() {
  return { apiUrl, webUrl, apiImage, webImage, deployedSha, sqlConnectionName };
}
