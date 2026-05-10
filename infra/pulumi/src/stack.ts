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
// Secret access bindings
// =============================================================================

interface RuntimeSecret {
  envVar: string;
  secret: string;
  services: ("api" | "web")[];
}

const runtimeSecrets: RuntimeSecret[] = [
  { envVar: "DATABASE_URL", secret: `${secretPrefix}database-url`, services: ["api"] },
  { envVar: "RAILS_MASTER_KEY", secret: `${secretPrefix}rails-master-key`, services: ["api"] },
  { envVar: "POSTMARK_API_TOKEN", secret: `${secretPrefix}postmark-api-token`, services: ["api"] },
  { envVar: "STRIPE_SECRET_KEY", secret: `${secretPrefix}stripe-secret-key`, services: ["api"] },
  { envVar: "STRIPE_WEBHOOK_SECRET", secret: `${secretPrefix}stripe-webhook-secret`, services: ["api"] },
  { envVar: "OPENAI_API_KEY", secret: `${secretPrefix}openai-api-key`, services: ["api"] },
  { envVar: "CLERK_SECRET_KEY", secret: `${secretPrefix}clerk-secret-key`, services: ["api", "web"] },
];

runtimeSecrets.forEach(({ secret }) => {
  new gcp.secretmanager.SecretIamMember(
    `runtime-sa-can-read-${secret}`,
    {
      project,
      secretId: secret,
      role: "roles/secretmanager.secretAccessor",
      member: pulumi.interpolate`serviceAccount:${runtimeSaEmail}`,
    },
    providerOpts
  );
});

// Web image needs the Clerk publishable key baked in at build time.
const publishableSecretName = `${secretPrefix}clerk-publishable-key`;
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
          secret: s.secret,
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
