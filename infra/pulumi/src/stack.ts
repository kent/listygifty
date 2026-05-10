import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as command from "@pulumi/command";
import * as path from "path";

// =============================================================================
// Configuration
// =============================================================================

const gcpConfig = new pulumi.Config("gcp");
const nfg = new pulumi.Config("niftygifty");

const project = gcpConfig.require("project");
const region = gcpConfig.require("region");
const environment = nfg.require("environment") as "staging" | "production";

const apiService = nfg.require("apiService");
const webService = nfg.require("webService");
const migrationJob = nfg.require("migrationJob");
const runtimeSaName = nfg.require("runtimeServiceAccountName");
const secretPrefix = nfg.require("secretPrefix");
const appDomain = nfg.require("appDomain");
const apiDomain = nfg.require("apiDomain");
const frontendUrl = nfg.require("frontendUrl");
const corsPublicOrigins = nfg.require("corsPublicOrigins");
const apiMinInstances = Number(nfg.require("apiMinInstances"));
const apiMaxInstances = Number(nfg.require("apiMaxInstances"));
const webMinInstances = Number(nfg.require("webMinInstances"));
const webMaxInstances = Number(nfg.require("webMaxInstances"));
const sqlInstanceName = nfg.require("sqlInstance");
const artifactRepository = nfg.require("artifactRepository");

// Whether to fire `eas build` after a successful Cloud Run rollout. Default on.
const enableMobile = nfg.getBoolean("enableMobile") ?? true;

// Source SHA — the deploy wrapper (or CI) sets this. We trigger image
// rebuilds when it changes, so `pulumi up` with the same SHA is a no-op.
const sourceSha = nfg.require("sourceSha");

const ROOT = path.resolve(__dirname, "..", "..", "..");

// =============================================================================
// Provider
// =============================================================================

const provider = new gcp.Provider("listygifty", { project, region });
const providerOpts = { provider };

// =============================================================================
// Artifact Registry + runtime service account
// =============================================================================

const artifacts = new gcp.artifactregistry.Repository(
  "container-images",
  {
    repositoryId: artifactRepository,
    location: region,
    format: "DOCKER",
    description: "Container images for niftygifty Cloud Run services",
  },
  { ...providerOpts, protect: true }
);

const runtimeSa = new gcp.serviceaccount.Account(
  "runtime-sa",
  {
    accountId: runtimeSaName,
    displayName: `niftygifty Cloud Run runtime (${environment})`,
  },
  providerOpts
);

const runtimeSaEmail = runtimeSa.email;

new gcp.projects.IAMMember(
  "runtime-sa-cloudsql",
  {
    project,
    role: "roles/cloudsql.client",
    member: pulumi.interpolate`serviceAccount:${runtimeSaEmail}`,
  },
  providerOpts
);

// =============================================================================
// Secrets — containers + IAM (values rotated via `gcloud secrets versions add`)
// =============================================================================
//
// Pulumi owns the shape: which secrets exist, what their replication policy is,
// who can read them, and whether they're protected from destroy. The raw values
// stay in Secret Manager itself and are rotated out-of-band via
// `gcloud secrets versions add` (or infra/gcp/scripts/sync-heroku-secrets.sh).
//
// Why values aren't in Pulumi: putting raw secret values in IaC state inflates
// the security surface (state file proliferation, easier to leak in PRs/logs).
// Best-practice GCP IaC owns the declaration and leaves the data plane to
// Secret Manager. Pulumi still enforces every other constraint.

interface RuntimeSecret {
  /** Env var name the runtime sees. */
  envVar: string;
  /** Stable, environment-agnostic slug; the actual Secret Manager name is
   *  `${secretPrefix}${slug}` so staging + production don't collide. */
  slug: string;
  /** Which Cloud Run services consume this secret at runtime. */
  services: ("api" | "web")[];
  /** Sensitivity tier — drives replication + lifecycle policy. */
  classification?: "high" | "standard";
}

const runtimeSecrets: RuntimeSecret[] = [
  // API runtime — high-value
  { envVar: "DATABASE_URL", slug: "database-url", services: ["api"], classification: "high" },
  { envVar: "RAILS_MASTER_KEY", slug: "rails-master-key", services: ["api"], classification: "high" },
  { envVar: "STRIPE_SECRET_KEY", slug: "stripe-secret-key", services: ["api"], classification: "high" },
  { envVar: "STRIPE_WEBHOOK_SECRET", slug: "stripe-webhook-secret", services: ["api"], classification: "high" },
  // API runtime — standard
  { envVar: "POSTMARK_API_TOKEN", slug: "postmark-api-token", services: ["api"] },
  { envVar: "OPENAI_API_KEY", slug: "openai-api-key", services: ["api"] },
  { envVar: "POSTHOG_API_KEY", slug: "posthog-api-key", services: ["api"] },
  // Shared
  { envVar: "CLERK_SECRET_KEY", slug: "clerk-secret-key", services: ["api", "web"], classification: "high" },
];

// The Clerk publishable key is also a Secret Manager entry because the web
// image bakes it in at build time; we read its value (not high-sensitivity)
// during the Cloud Build step below.
const publishableSecretSlug = "clerk-publishable-key";

// Map of slug → Secret resource, used for IAM + service env bindings below.
const secretResources = new Map<string, gcp.secretmanager.Secret>();

function declareSecret(slug: string, opts?: { description?: string }) {
  const name = `${secretPrefix}${slug}`;
  const resource = new gcp.secretmanager.Secret(
    `secret-${slug}`,
    {
      secretId: name,
      replication: { auto: {} }, // single-region replication; revisit if we go multi-region
      labels: {
        environment,
        managed_by: "pulumi",
      },
      ...(opts?.description ? { annotations: { description: opts.description } } : {}),
    },
    {
      ...providerOpts,
      // Secrets must NEVER be destroyed by pulumi — losing the container also
      // loses the version history. Rotation is via new versions, not new
      // secrets.
      protect: true,
      // If a secret with this name already exists (it does, from sync scripts),
      // adopt it instead of failing.
      retainOnDelete: true,
    }
  );
  secretResources.set(slug, resource);
  return resource;
}

runtimeSecrets.forEach((s) => declareSecret(s.slug, { description: `${s.envVar} for ${environment}` }));
declareSecret(publishableSecretSlug, { description: `Clerk publishable key (baked into web image)` });

// Grant the runtime SA accessor permission on every runtime secret.
runtimeSecrets.forEach(({ slug }) => {
  const fullName = `${secretPrefix}${slug}`;
  new gcp.secretmanager.SecretIamMember(
    `runtime-sa-can-read-${slug}`,
    {
      project,
      secretId: fullName,
      role: "roles/secretmanager.secretAccessor",
      member: pulumi.interpolate`serviceAccount:${runtimeSaEmail}`,
    },
    { ...providerOpts, dependsOn: [secretResources.get(slug)!] }
  );
});

// Also grant Cloud Build's default SA read access to the publishable key
// (needed during web image build). The Cloud Build SA is auto-created by GCP.
const cloudBuildSa = pulumi.interpolate`${gcpConfig.require("project")}@cloudbuild.gserviceaccount.com`;
// (left for ops: granting cloud build SA access happens manually via the
// project IAM — kept out of Pulumi to avoid stepping on existing grants.)

// Web image needs the Clerk publishable key baked in at build time. We pull
// the value at deploy time from the Pulumi-managed secret.
const publishableSecretName = `${secretPrefix}${publishableSecretSlug}`;
const publishableKey = gcp.secretmanager.getSecretVersionOutput(
  { secret: publishableSecretName, project },
  providerOpts
).secretData;

function secretEnvBindings(forService: "api" | "web") {
  return runtimeSecrets
    .filter((s) => s.services.includes(forService))
    .map((s) => ({
      name: s.envVar,
      valueSource: {
        secretKeyRef: {
          secret: `${secretPrefix}${s.slug}`,
          version: "latest",
        },
      },
    }));
}

// =============================================================================
// Image builds (Cloud Build, invoked as Pulumi resources)
// =============================================================================

const containerRepoUri = `${region}-docker.pkg.dev/${project}/${artifactRepository}`;
const apiImageUri = `${containerRepoUri}/api:${sourceSha}`;
const webImageUri = `${containerRepoUri}/web:${sourceSha}`;

const buildApi = new command.local.Command(
  "build-api",
  {
    create: pulumi.interpolate`gcloud builds submit \
      --project=${project} \
      --config=${ROOT}/infra/gcp/cloudbuild.api.yaml \
      --substitutions=_IMAGE=${apiImageUri} \
      --suppress-logs \
      ${ROOT}`,
    triggers: [sourceSha],
    environment: { CLOUDSDK_CORE_PROJECT: project },
  },
  { dependsOn: [artifacts] }
);

const buildWeb = new command.local.Command(
  "build-web",
  {
    create: pulumi.interpolate`gcloud builds submit \
      --project=${project} \
      --config=${ROOT}/infra/gcp/cloudbuild.web.yaml \
      --substitutions=_IMAGE=${webImageUri},_NEXT_PUBLIC_API_URL=https://${apiDomain},_NEXT_PUBLIC_APP_URL=${frontendUrl},_NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${publishableKey},_NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login,_NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup,_NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard,_NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard,_NEXT_PUBLIC_POSTHOG_KEY=,_NEXT_PUBLIC_POSTHOG_HOST= \
      --suppress-logs \
      ${ROOT}`,
    triggers: [sourceSha],
    environment: { CLOUDSDK_CORE_PROJECT: project },
  },
  { dependsOn: [artifacts] }
);

// =============================================================================
// Cloud SQL (referenced, never managed)
// =============================================================================

const sqlInstance = gcp.sql.DatabaseInstance.get(
  "sql-instance",
  sqlInstanceName,
  undefined,
  providerOpts
);

// =============================================================================
// Cloud Run: API service
// =============================================================================

const apiEnvVars: Record<string, string> = {
  RAILS_ENV: "production",
  RACK_ENV: "production",
  RAILS_LOG_LEVEL: "info",
  RAILS_ENABLE_YJIT: "true",
  CLERK_SKIP_RAILTIE: "1",
  APP_DOMAIN: appDomain,
  FRONTEND_URL: frontendUrl,
  CORS_ORIGINS: corsPublicOrigins,
  SOLID_QUEUE_IN_PUMA: "1",
  WEB_CONCURRENCY: "0",
  PUMA_PERSISTENT_TIMEOUT: "20",
  RAILS_MIN_THREADS: "3",
  RAILS_MAX_THREADS: "3",
  DB_POOL: "3",
  JOB_CONCURRENCY: "1",
  JOB_THREADS: "1",
};

const apiServiceResource = new gcp.cloudrunv2.Service(
  "api-service",
  {
    name: apiService,
    location: region,
    ingress: "INGRESS_TRAFFIC_ALL",
    deletionProtection: environment === "production",
    template: {
      serviceAccount: runtimeSaEmail,
      timeout: "300s",
      maxInstanceRequestConcurrency: 80,
      scaling: {
        minInstanceCount: apiMinInstances,
        maxInstanceCount: apiMaxInstances,
      },
      containers: [
        {
          image: apiImageUri,
          ports: { containerPort: 8080 },
          resources: { limits: { cpu: "1", memory: "1Gi" } },
          envs: [
            ...Object.entries(apiEnvVars).map(([name, value]) => ({ name, value })),
            ...secretEnvBindings("api"),
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
    traffics: [{ type: "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST", percent: 100 }],
  },
  { ...providerOpts, dependsOn: [buildApi] }
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
// Cloud Run: Web service
// =============================================================================

const webEnvVars: Record<string, string> = {
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_APP_URL: frontendUrl,
  NEXT_PUBLIC_API_URL: `https://${apiDomain}`,
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/login",
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/signup",
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: "/dashboard",
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: "/dashboard",
};

const webServiceResource = new gcp.cloudrunv2.Service(
  "web-service",
  {
    name: webService,
    location: region,
    ingress: "INGRESS_TRAFFIC_ALL",
    deletionProtection: environment === "production",
    template: {
      serviceAccount: runtimeSaEmail,
      timeout: "300s",
      maxInstanceRequestConcurrency: 80,
      scaling: {
        minInstanceCount: webMinInstances,
        maxInstanceCount: webMaxInstances,
      },
      containers: [
        {
          image: webImageUri,
          ports: { containerPort: 8080 },
          resources: { limits: { cpu: "1", memory: "512Mi" } },
          envs: [
            ...Object.entries(webEnvVars).map(([name, value]) => ({ name, value })),
            ...secretEnvBindings("web"),
          ],
        },
      ],
    },
    traffics: [{ type: "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST", percent: 100 }],
  },
  { ...providerOpts, dependsOn: [buildWeb] }
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
// Migration job + execution
// =============================================================================

const migrationJobResource = new gcp.cloudrunv2.Job(
  "api-migrate",
  {
    name: migrationJob,
    location: region,
    template: {
      taskCount: 1,
      template: {
        serviceAccount: runtimeSaEmail,
        timeout: "900s",
        maxRetries: 1,
        containers: [
          {
            image: apiImageUri,
            commands: ["bundle"],
            args: ["exec", "rails", "db:migrate"],
            resources: { limits: { cpu: "1", memory: "1Gi" } },
            envs: [
              ...Object.entries(apiEnvVars).map(([name, value]) => ({ name, value })),
              ...secretEnvBindings("api"),
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
  { ...providerOpts, dependsOn: [buildApi] }
);

const runMigrations = new command.local.Command(
  "run-migrations",
  {
    create: pulumi.interpolate`gcloud run jobs execute ${migrationJob} \
      --project=${project} --region=${region} --wait`,
    triggers: [sourceSha],
    environment: { CLOUDSDK_CORE_PROJECT: project },
  },
  { dependsOn: [migrationJobResource, apiServiceResource] }
);

// =============================================================================
// Domain mappings
// =============================================================================

new gcp.cloudrun.DomainMapping(
  "api-domain",
  {
    location: region,
    name: apiDomain,
    metadata: { namespace: project },
    spec: { routeName: apiServiceResource.name },
  },
  { ...providerOpts, dependsOn: [apiServiceResource] }
);

new gcp.cloudrun.DomainMapping(
  "web-domain",
  {
    location: region,
    name: appDomain,
    metadata: { namespace: project },
    spec: { routeName: webServiceResource.name },
  },
  { ...providerOpts, dependsOn: [webServiceResource] }
);

// =============================================================================
// Smoke tests
// =============================================================================

const smokeScript = pulumi.interpolate`bash -c '
set -e
api_url="$(gcloud run services describe ${apiService} --project=${project} --region=${region} --format="value(status.url)")"
web_url="$(gcloud run services describe ${webService} --project=${project} --region=${region} --format="value(status.url)")"
check() {
  code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$2")"
  [ "$code" = "$3" ] || { echo "FAIL: $1 expected $3 got $code ($2)" >&2; exit 1; }
  echo "  ✓ $1 ($code)"
}
check "API /up"                         "$api_url/up"       200
check "API /holidays (unauthenticated)" "$api_url/holidays" 401
check "web /"                           "$web_url/"         200
check "web /login"                      "$web_url/login"    200
'`;

const smoke = new command.local.Command(
  "smoke-tests",
  {
    create: smokeScript,
    triggers: [sourceSha],
  },
  { dependsOn: [runMigrations, webServiceResource] }
);

// =============================================================================
// Mobile: EAS build + auto-submit (fire-and-forget on EAS infra)
// =============================================================================

if (enableMobile) {
  new command.local.Command(
    "eas-build",
    {
      create: pulumi.interpolate`bash -c '
if ! command -v eas >/dev/null 2>&1; then
  echo "eas CLI not installed (npm i -g eas-cli) — skipping mobile build" >&2
  exit 0
fi
cd ${ROOT}/apps/mobile
eas build --profile ${environment} --platform all --non-interactive --no-wait --auto-submit
'`,
      triggers: [sourceSha],
    },
    { dependsOn: [smoke] }
  );
}

// =============================================================================
// Outputs
// =============================================================================

export const apiUrl = apiServiceResource.uri;
export const webUrl = webServiceResource.uri;
export const runtimeServiceAccount = runtimeSaEmail;
export const containerRepo = containerRepoUri;
export const sqlConnectionName = sqlInstance.connectionName;
export const deployedSha = sourceSha;

export function buildStack() {
  return { apiUrl, webUrl, runtimeServiceAccount, containerRepo, sqlConnectionName, deployedSha };
}
