# Migration Plan: GCP → Fly.io + Neon (agent-executable)

**Created:** 2026-06-03
**Owner:** Kent
**Target:** Phased 2-3 week rollout (staging → prod cutover)

This plan is structured so an autonomous agent can execute each step. Every step is either (a) a shell command, (b) a file write, or (c) an explicit **HUMAN INPUT REQUIRED** gate. Every verification has an executable check with the exact expected outcome.

---

## Conventions used in this plan

- `$VAR` — a shell variable the agent must `export` before later steps. Capture commands are shown.
- `# expect: <pattern>` — the line above must produce output matching this. If it doesn't, **STOP** and report.
- **🛑 HUMAN GATE** — block here, ask Kent the question, do not proceed until answered.
- **✅ CHECK** — verification command; agent must run it and confirm before moving on.
- All paths absolute. All commands assumed run from `~/bliss/listygifty` unless stated.

---

## 🛑 HUMAN GATES — collect answers before Phase 0

The agent must collect these answers from Kent before running any command. Save them to `~/bliss/listygifty/.claude/plans/migration-inputs.env` as `export KEY=value` lines.

| Key | Question | Suggested default |
|---|---|---|
| `FLY_ORG` | Which Fly.io organization to deploy under? | `personal` |
| `FLY_REGION` | Primary Fly region? | `iad` (Ashburn — closest to current `us-central1`) |
| `NEON_REGION` | Neon region? | `aws-us-east-2` (closest to `iad`) |
| `NEON_PLAN_PROD` | Neon plan for production? | `Launch` ($19/mo, 7-day PITR) |
| `BLOB_PROVIDER` | Tigris (Fly-native) or Cloudflare R2? | `tigris` |
| `DNS_PROVIDER` | Who manages `listygifty.com` DNS today? | (unknown — find via `dig NS listygifty.com`) |
| `WORKER_TOPOLOGY` | Run Solid Queue in API Machine (cheap) or dedicated worker Machine (+$5/mo)? | `in-api-machine` |
| `MAINT_WINDOW_START` | When to run Phase 3 cutover? | Saturday morning local |
| `STAGING_API_HOST` | Custom staging API hostname or use `*.fly.dev`? | `api-staging.listygifty.com` |
| `STAGING_WEB_HOST` | Custom staging web hostname? | `staging.listygifty.com` |

Run this to capture DNS provider automatically:
```bash
dig +short NS listygifty.com
# expect: 2+ nameserver hostnames; map to provider (cloudflare.com → Cloudflare, awsdns → Route53, etc.)
```

---

## Phase 0 — Prerequisites + accounts

### 0.1 Verify tooling installed locally

```bash
for bin in fly gh gcloud git rclone pg_dump pg_restore psql jq curl docker; do
  command -v "$bin" >/dev/null || { echo "MISSING: $bin"; exit 1; }
done
echo "all tools present"
# expect: "all tools present"
```

If anything is missing:
```bash
brew install flyctl gh google-cloud-sdk rclone libpq jq && \
  brew install --cask docker
```

### 0.2 Authenticate CLIs

```bash
fly auth whoami       # expect: an email; if not, run: fly auth login
gcloud config configurations activate listygifty
gcloud auth print-access-token >/dev/null   # expect: token; else: gcloud auth login
gh auth status        # expect: "Logged in"
```

### 0.3 Create Neon account + projects

Neon does not have a public CLI signup. Do this manually one time:

🛑 **HUMAN GATE:** Open https://console.neon.tech, create account (use `kent.fenwick@gmail.com`), then create two projects:
- Name: `listygifty-staging`, region: `$NEON_REGION`, Postgres 16
- Name: `listygifty-production`, region: `$NEON_REGION`, Postgres 16, plan: `$NEON_PLAN_PROD`

After creation, paste the two connection strings into `~/bliss/listygifty/.claude/plans/migration-inputs.env`:
```
export NEON_STAGING_URL="postgres://...neon.tech/neondb?sslmode=require"
export NEON_PRODUCTION_URL="postgres://...neon.tech/neondb?sslmode=require"
```

### 0.4 Verify Neon connectivity

```bash
source ~/bliss/listygifty/.claude/plans/migration-inputs.env
psql "$NEON_STAGING_URL" -c "SELECT version();"
# expect: "PostgreSQL 16.x" in output
psql "$NEON_PRODUCTION_URL" -c "SELECT version();"
# expect: "PostgreSQL 16.x" in output
```

### 0.5 Create migration branch

```bash
cd ~/bliss/listygifty
git checkout main && git pull
git checkout -b migration/fly-neon
git push -u origin migration/fly-neon
# expect: branch tracked on origin
```

### 0.6 Create Fly apps (empty shells)

```bash
source ~/bliss/listygifty/.claude/plans/migration-inputs.env

for app in listygifty-api-staging listygifty-web-staging listygifty-api-prod listygifty-web-prod; do
  fly apps create "$app" --org "$FLY_ORG" 2>&1 | tee /tmp/fly-create-$app.log
done

fly apps list --org "$FLY_ORG" | grep -E "listygifty-(api|web)-(staging|prod)" | wc -l
# expect: 4
```

### 0.7 Create Tigris buckets (if `$BLOB_PROVIDER = tigris`)

```bash
fly storage create --name listygifty-staging-storage -a listygifty-api-staging
# expect: prints AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, BUCKET_NAME, AWS_ENDPOINT_URL_S3
# the secrets are auto-attached to the api-staging app; capture them for use in web/migrations:

fly secrets list -a listygifty-api-staging | grep AWS_
# expect: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, BUCKET_NAME, AWS_ENDPOINT_URL_S3

fly storage create --name listygifty-prod-storage -a listygifty-api-prod
fly secrets list -a listygifty-api-prod | grep AWS_
# expect: same 4 vars
```

### ✅ Phase 0 exit criteria

Run all of:
```bash
fly apps list --org "$FLY_ORG" | grep -c listygifty                  # expect: 4
psql "$NEON_STAGING_URL" -c "SELECT 1" | grep -c "1 row"             # expect: 1
psql "$NEON_PRODUCTION_URL" -c "SELECT 1" | grep -c "1 row"          # expect: 1
git -C ~/bliss/listygifty branch --show-current                      # expect: migration/fly-neon
test -f ~/bliss/listygifty/.claude/plans/migration-inputs.env && echo OK   # expect: OK
```

---

## Phase 1 — Staging on Fly + Neon

### 1.1 Pull current secret values from GCP Secret Manager

```bash
source ~/bliss/listygifty/.claude/plans/migration-inputs.env
gcloud config configurations activate listygifty

# Pull staging secret values into env file for re-injection to Fly.
mkdir -p ~/bliss/listygifty/.claude/plans/secrets
SECRETS_FILE=~/bliss/listygifty/.claude/plans/secrets/staging.env
: > "$SECRETS_FILE"
chmod 600 "$SECRETS_FILE"

for slug in clerk-secret-key stripe-secret-key stripe-webhook-secret \
            postmark-api-token openai-api-key allowed-hosts cors-origins \
            frontend-url app-base stripe-public-key; do
  val=$(gcloud secrets versions access latest --secret="niftygifty-staging-${slug}" 2>/dev/null || \
        gcloud secrets versions access latest --secret="niftygifty-${slug}" 2>/dev/null)
  [ -z "$val" ] && { echo "MISSING: $slug"; exit 1; }
  upper=$(echo "$slug" | tr 'a-z-' 'A-Z_')
  printf 'export %s=%q\n' "$upper" "$val" >> "$SECRETS_FILE"
done

# Rails master key for staging
rails_key=$(gcloud secrets versions access latest --secret=listygifty-rails-key-staging)
printf 'export SECRET_KEY_BASE=%q\n' "$rails_key" >> "$SECRETS_FILE"

wc -l "$SECRETS_FILE"
# expect: 11 lines
```

### 1.2 Add Active Storage S3 adapter to API

```bash
cd ~/bliss/listygifty/apps/api
# Add aws-sdk-s3 to Gemfile if missing
grep -q "aws-sdk-s3" Gemfile || cat >> Gemfile <<'RUBY'

# Tigris / S3-compatible blob storage
gem "aws-sdk-s3", require: false
RUBY
bundle install
git add Gemfile Gemfile.lock
git commit -m "Add aws-sdk-s3 gem for Tigris Active Storage"
```

Append the `tigris:` block to `config/storage.yml`:

```bash
cat >> ~/bliss/listygifty/apps/api/config/storage.yml <<'YAML'

tigris:
  service: S3
  access_key_id: <%= ENV["AWS_ACCESS_KEY_ID"] %>
  secret_access_key: <%= ENV["AWS_SECRET_ACCESS_KEY"] %>
  endpoint: <%= ENV.fetch("AWS_ENDPOINT_URL_S3", "https://fly.storage.tigris.dev") %>
  region: auto
  bucket: <%= ENV["BUCKET_NAME"] %>
  force_path_style: true
YAML
```

Edit `config/environments/staging.rb` (and production.rb) to set:
```ruby
config.active_storage.service = ENV.fetch("ACTIVE_STORAGE_SERVICE", "google").to_sym
```
(Search for existing `config.active_storage.service` line and replace it.)

```bash
grep "active_storage.service" ~/bliss/listygifty/apps/api/config/environments/staging.rb
# expect: line containing ENV.fetch("ACTIVE_STORAGE_SERVICE"...
```

### 1.3 Create `fly.staging.toml` for API

Write `~/bliss/listygifty/apps/api/fly.staging.toml`:

```toml
app = "listygifty-api-staging"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  RAILS_ENV = "staging"
  PORT = "3000"
  RAILS_MAX_THREADS = "5"
  RAILS_MIN_THREADS = "5"
  ACTIVE_STORAGE_SERVICE = "tigris"
  RAILS_LOG_TO_STDOUT = "true"
  RAILS_SERVE_STATIC_FILES = "true"

[deploy]
  release_command = "bundle exec rails db:migrate"

[processes]
  web = "bundle exec puma -C config/puma.rb"
  worker = "bundle exec rails solid_queue:start"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "off"
  auto_start_machines = true
  min_machines_running = 1
  processes = ["web"]

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
  processes = ["web"]

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
  processes = ["worker"]

[[http_service.checks]]
  grace_period = "30s"
  interval = "15s"
  method = "GET"
  timeout = "5s"
  path = "/up"
```

### 1.4 Push secrets to API staging

```bash
source ~/bliss/listygifty/.claude/plans/migration-inputs.env
source ~/bliss/listygifty/.claude/plans/secrets/staging.env

fly secrets set -a listygifty-api-staging --stage \
  DATABASE_URL="$NEON_STAGING_URL" \
  SECRET_KEY_BASE="$SECRET_KEY_BASE" \
  CLERK_SECRET_KEY="$CLERK_SECRET_KEY" \
  STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" \
  STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" \
  POSTMARK_API_TOKEN="$POSTMARK_API_TOKEN" \
  OPENAI_API_KEY="$OPENAI_API_KEY" \
  CORS_ORIGINS="https://${STAGING_WEB_HOST}" \
  FRONTEND_URL="https://${STAGING_WEB_HOST}" \
  ALLOWED_HOSTS="listygifty-api-staging.fly.dev,${STAGING_API_HOST}"

# AWS_* / BUCKET_NAME were already attached to this app by `fly storage create`
fly secrets list -a listygifty-api-staging | awk 'NR>1 {print $1}' | sort
# expect: ALLOWED_HOSTS, AWS_ACCESS_KEY_ID, AWS_ENDPOINT_URL_S3, AWS_REGION,
#         AWS_SECRET_ACCESS_KEY, BUCKET_NAME, CLERK_SECRET_KEY, CORS_ORIGINS,
#         DATABASE_URL, FRONTEND_URL, OPENAI_API_KEY, POSTMARK_API_TOKEN,
#         SECRET_KEY_BASE, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
```

### 1.5 Deploy API to staging

```bash
cd ~/bliss/listygifty/apps/api
fly deploy --config fly.staging.toml --remote-only --wait-timeout 600
# expect: ends with "1 desired, 1 placed, 1 healthy, 0 unhealthy [job=web]"
```

### ✅ Phase 1.5 verification (API)

```bash
API_URL="https://listygifty-api-staging.fly.dev"

curl -sS -o /dev/null -w "%{http_code}" "$API_URL/up"
# expect: 200

curl -sS -o /dev/null -w "%{http_code}" "$API_URL/holidays"
# expect: 401

# Migrations applied
fly ssh console -a listygifty-api-staging -C "bin/rails db:migrate:status" | grep -c "down"
# expect: 0

# Solid Queue worker process running
fly machine list -a listygifty-api-staging --json | jq -r '.[].config.metadata.fly_process_group' | sort -u
# expect: lines including "web" and "worker"

# Tigris write/read round-trip
fly ssh console -a listygifty-api-staging -C "bin/rails runner \"
  blob = ActiveStorage::Blob.create_and_upload!(
    io: StringIO.new('hello tigris'),
    filename: 'smoketest.txt',
    content_type: 'text/plain'
  )
  puts blob.url(expires_in: 5.minutes)
\"" | tail -1 > /tmp/blob_url.txt
curl -sS "$(cat /tmp/blob_url.txt)" | grep -c "hello tigris"
# expect: 1
```

### 1.6 Create `fly.staging.toml` for Web

Write `~/bliss/listygifty/apps/web/fly.staging.toml`:

```toml
app = "listygifty-web-staging"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"
  [build.args]
    NEXT_PUBLIC_API_URL = "https://listygifty-api-staging.fly.dev"
    NEXT_PUBLIC_APP_URL = "https://listygifty-web-staging.fly.dev"

[env]
  NODE_ENV = "production"
  PORT = "8080"
  NEXT_TELEMETRY_DISABLED = "1"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"

[[http_service.checks]]
  grace_period = "30s"
  interval = "15s"
  method = "GET"
  timeout = "5s"
  path = "/"
```

The web Dockerfile expects `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` as a build arg. Fetch and pass it:

```bash
# Clerk publishable key for staging is in GCP Secret Manager? — check first:
gcloud secrets list --filter="name~clerk-publishable" --format="value(name)"
# If empty, get from Clerk dashboard (https://dashboard.clerk.com → staging instance → API keys)
# Set as a non-secret build arg in fly.staging.toml under [build.args]
```

🛑 **HUMAN GATE:** Paste the Clerk **publishable** key for the staging environment when prompted by the build. Add it to `apps/web/fly.staging.toml` under `[build.args]` as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_..."`.

### 1.7 Push web secrets and deploy

```bash
source ~/bliss/listygifty/.claude/plans/secrets/staging.env

fly secrets set -a listygifty-web-staging --stage \
  CLERK_SECRET_KEY="$CLERK_SECRET_KEY" \
  APP_BASE="$APP_BASE" \
  STRIPE_PUBLIC_KEY="$STRIPE_PUBLIC_KEY"

cd ~/bliss/listygifty/apps/web
# Web dockerfile reads from monorepo root; deploy from there with --config flag:
cd ~/bliss/listygifty
fly deploy --config apps/web/fly.staging.toml --remote-only --wait-timeout 600
# expect: "1 desired, 1 placed, 1 healthy"
```

### ✅ Phase 1.7 verification (Web)

```bash
WEB_URL="https://listygifty-web-staging.fly.dev"

curl -sS -o /dev/null -w "%{http_code}" "$WEB_URL/"
# expect: 200
curl -sS -o /dev/null -w "%{http_code}" "$WEB_URL/login"
# expect: 200

# Confirm web is talking to new API (looks for the API origin in HTML/JS)
curl -sS "$WEB_URL/login" | grep -c "listygifty-api-staging.fly.dev"
# expect: 1 or more

# No CORS errors in browser flow (manual — agent emits browser instructions)
echo "MANUAL: open $WEB_URL/login in browser, complete login, verify dashboard loads"
```

### 1.8 Mobile staging build

```bash
# Update Expo config with new staging API URL
file=~/bliss/listygifty/apps/mobile/app.config.ts
grep -q "listygifty-api-staging.fly.dev" "$file" && echo "already updated" || \
  echo "MANUAL: update apiBaseUrl in $file for staging variant to https://listygifty-api-staging.fly.dev"

# Build new staging TestFlight (uses existing EAS workflow from memory reference_listygifty_eas_build.md)
cd ~/bliss/listygifty/apps/mobile && \
  EXPO_ASC_API_KEY_PATH=~/.appstoreconnect/private_keys/AuthKey_MUKQ5K89U7.p8 \
  EXPO_ASC_KEY_ID=MUKQ5K89U7 \
  EXPO_ASC_ISSUER_ID=69a6de6e-8f71-47e3-e053-5b8c7c11a4d1 \
  EXPO_APPLE_TEAM_ID=PS5W7BFTQ2 \
  EXPO_APPLE_TEAM_TYPE=INDIVIDUAL \
  eas build --platform ios --profile staging --auto-submit --non-interactive --no-wait
# expect: "Build started ..."
```

### ✅ Phase 1 exit criteria

Manual smoke (agent emits the checklist; Kent ticks it):
- [ ] Sign up a new test account via web staging → 200 throughout, lands on `/dashboard`.
- [ ] Create a new list, add 3 gifts including one image upload.
- [ ] Refresh page; data persists.
- [ ] Image URL resolves and shows the image.
- [ ] iOS staging build (TestFlight) signs in, sees same list.
- [ ] Stripe test purchase (`4242 4242 4242 4242`) completes; webhook delivers (check `fly logs -a listygifty-api-staging | grep webhook`).
- [ ] Trigger a Postmark email (forgot-password); it arrives.

---

## Phase 2 — Production dry-run (read-only against prod)

### 2.1 Capture prod DB dump

```bash
source ~/bliss/listygifty/.claude/plans/migration-inputs.env
gcloud config configurations activate listygifty

# Start Cloud SQL proxy in background
cloud-sql-proxy listygifty:us-central1:niftygifty-postgres-central --port 5433 &
PROXY_PID=$!
sleep 5

# Fetch the prod DATABASE_URL from Secret Manager to extract user/pass/dbname
PROD_DB_URL=$(gcloud secrets versions access latest --secret=niftygifty-database-url)
# parse user/pass/db from URL
PG_USER=$(echo "$PROD_DB_URL" | sed -E 's|postgres://([^:]+):.*|\1|')
PG_PASS=$(echo "$PROD_DB_URL" | sed -E 's|postgres://[^:]+:([^@]+)@.*|\1|')
PG_DB=$(echo "$PROD_DB_URL" | sed -E 's|.*/([^?]+).*|\1|')

DUMP_FILE=/tmp/lg-prod-$(date +%Y%m%d-%H%M%S).dump
PGPASSWORD="$PG_PASS" pg_dump --no-owner --no-acl --format=custom \
  -h 127.0.0.1 -p 5433 -U "$PG_USER" -d "$PG_DB" \
  -f "$DUMP_FILE"

ls -lh "$DUMP_FILE"
# expect: file > 1 MB
echo "DUMP=$DUMP_FILE" >> ~/bliss/listygifty/.claude/plans/migration-inputs.env

kill $PROXY_PID
```

### 2.2 Create Neon dry-run branch

Use Neon's CLI (install if missing: `npm i -g neonctl`):

```bash
neonctl auth     # one-time browser login
NEON_PROJECT_ID=$(neonctl projects list --output json | jq -r '.[] | select(.name=="listygifty-production") | .id')
echo "PROJECT=$NEON_PROJECT_ID"   # expect: id string

neonctl branches create --project-id "$NEON_PROJECT_ID" --name pg-restore-dryrun
NEON_DRYRUN_URL=$(neonctl connection-string pg-restore-dryrun --project-id "$NEON_PROJECT_ID")
echo "export NEON_DRYRUN_URL=\"$NEON_DRYRUN_URL\"" >> ~/bliss/listygifty/.claude/plans/migration-inputs.env
```

### 2.3 Restore into Neon dry-run

```bash
source ~/bliss/listygifty/.claude/plans/migration-inputs.env

time pg_restore -d "$NEON_DRYRUN_URL" --no-owner --no-acl -j 4 "$DUMP"
# expect: completes within agreed cutover window (target < 15 min)
```

### ✅ Phase 2.3 verification — row count diff

```bash
# Cloud SQL side (via proxy)
cloud-sql-proxy listygifty:us-central1:niftygifty-postgres-central --port 5433 &
PROXY_PID=$!
sleep 5
PGPASSWORD="$PG_PASS" psql -h 127.0.0.1 -p 5433 -U "$PG_USER" -d "$PG_DB" \
  -A -F, -t -c "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname" \
  > /tmp/counts-gcp.csv
kill $PROXY_PID

# Neon side
psql "$NEON_DRYRUN_URL" \
  -A -F, -t -c "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname" \
  > /tmp/counts-neon.csv

diff /tmp/counts-gcp.csv /tmp/counts-neon.csv
# expect: no output (identical)
```

If `n_live_tup` drifts (it can — stats lag), use deterministic counts:
```bash
PGPASSWORD="$PG_PASS" psql -h 127.0.0.1 -p 5433 -U "$PG_USER" -d "$PG_DB" -t -c "
  SELECT 'users', COUNT(*) FROM users UNION ALL
  SELECT 'lists', COUNT(*) FROM lists UNION ALL
  SELECT 'gifts', COUNT(*) FROM gifts UNION ALL
  SELECT 'subscriptions', COUNT(*) FROM subscriptions
" > /tmp/exact-gcp.txt

psql "$NEON_DRYRUN_URL" -t -c "
  SELECT 'users', COUNT(*) FROM users UNION ALL
  SELECT 'lists', COUNT(*) FROM lists UNION ALL
  SELECT 'gifts', COUNT(*) FROM gifts UNION ALL
  SELECT 'subscriptions', COUNT(*) FROM subscriptions
" > /tmp/exact-neon.txt

diff /tmp/exact-gcp.txt /tmp/exact-neon.txt
# expect: no output
```

### 2.4 Active Storage blob dry-run

```bash
# Configure rclone for both endpoints (one-time)
cat >> ~/.config/rclone/rclone.conf <<EOF
[gcs-listygifty]
type = google cloud storage
project_number = 906707282968
service_account_file = /Users/kent/.gcp/keys/listygifty-deployer.json
location = us-central1

[tigris-prod]
type = s3
provider = Other
access_key_id = $(fly secrets list -a listygifty-api-prod --json | jq -r '.[] | select(.Name=="AWS_ACCESS_KEY_ID") | .Value')
secret_access_key = $(fly secrets list -a listygifty-api-prod --json | jq -r '.[] | select(.Name=="AWS_SECRET_ACCESS_KEY") | .Value')
endpoint = https://fly.storage.tigris.dev
EOF
# NOTE: fly secrets list does not expose values. Pull them once at storage create time and cache.
```

🛑 **AGENT NOTE:** `fly secrets list --json` does NOT print values. Tigris keys were printed exactly once at `fly storage create`. If lost, run `fly storage update --name listygifty-prod-storage --rotate` and capture.

```bash
# Use rclone size to compare
rclone size gcs-listygifty:listygifty-active-storage-production > /tmp/gcs-size.txt
cat /tmp/gcs-size.txt
# expect: prints object count and total bytes

# Initial sync (this is the long-running step)
rclone sync gcs-listygifty:listygifty-active-storage-production tigris-prod:listygifty-prod-storage \
  --progress --checksum --transfers 16 2>&1 | tee /tmp/rclone-initial.log

rclone size tigris-prod:listygifty-prod-storage > /tmp/tigris-size.txt
diff /tmp/gcs-size.txt /tmp/tigris-size.txt
# expect: no output (identical object counts and bytes)
```

### ✅ Phase 2 exit criteria

- [ ] Diff on row counts returns empty.
- [ ] Diff on object counts/bytes returns empty.
- [ ] Pre-warmed Fly prod apps (`listygifty-api-prod`, `listygifty-web-prod`) deployed against `NEON_DRYRUN_URL` + Tigris prod bucket pass the same smoke script as staging.

---

## Phase 3 — Production cutover

### 3.1 Pre-cutover (T-48 h)

🛑 **HUMAN GATE:** Lower DNS TTLs on the 3 hostnames to **60s** at `$DNS_PROVIDER`.

For Cloudflare (most likely):
```bash
# If using Cloudflare and CLOUDFLARE_API_TOKEN exported:
ZONE_ID=$(curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones?name=listygifty.com" | jq -r '.result[0].id')

for host in listygifty.com www.listygifty.com api.listygifty.com; do
  REC_ID=$(curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=$host" \
    | jq -r '.result[0].id')
  curl -sS -X PATCH \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"ttl":60}' \
    "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$REC_ID" | jq .success
  # expect: true
done
```

### 3.2 Pre-cutover (T-24 h) — pre-warm prod apps

Same flow as Phase 1.1-1.7 but for the prod apps. Secrets are pulled with `niftygifty-*` prefix (no `-staging-`):

```bash
SECRETS_FILE=~/bliss/listygifty/.claude/plans/secrets/production.env
: > "$SECRETS_FILE"
chmod 600 "$SECRETS_FILE"
for slug in clerk-secret-key stripe-secret-key stripe-webhook-secret \
            postmark-api-token openai-api-key allowed-hosts cors-origins \
            frontend-url app-base stripe-public-key; do
  val=$(gcloud secrets versions access latest --secret="niftygifty-${slug}")
  upper=$(echo "$slug" | tr 'a-z-' 'A-Z_')
  printf 'export %s=%q\n' "$upper" "$val" >> "$SECRETS_FILE"
done
val=$(gcloud secrets versions access latest --secret=listygifty-rails-key-prod)
printf 'export SECRET_KEY_BASE=%q\n' "$val" >> "$SECRETS_FILE"

# Create fly.production.toml files: copy staging versions, edit RAILS_ENV → production,
# app names → -prod, hostnames → real prod hosts, min_machines_running → 1 for web too.
cp ~/bliss/listygifty/apps/api/fly.staging.toml ~/bliss/listygifty/apps/api/fly.production.toml
sed -i '' 's/listygifty-api-staging/listygifty-api-prod/g; s/RAILS_ENV = "staging"/RAILS_ENV = "production"/' \
  ~/bliss/listygifty/apps/api/fly.production.toml

cp ~/bliss/listygifty/apps/web/fly.staging.toml ~/bliss/listygifty/apps/web/fly.production.toml
sed -i '' 's/listygifty-web-staging/listygifty-web-prod/g; s/listygifty-api-staging/listygifty-api-prod/g; s/min_machines_running = 0/min_machines_running = 1/' \
  ~/bliss/listygifty/apps/web/fly.production.toml

# Push prod secrets (DATABASE_URL points at DRY-RUN branch for pre-warm only)
source ~/bliss/listygifty/.claude/plans/secrets/production.env
source ~/bliss/listygifty/.claude/plans/migration-inputs.env

fly secrets set -a listygifty-api-prod --stage \
  DATABASE_URL="$NEON_DRYRUN_URL" \
  SECRET_KEY_BASE="$SECRET_KEY_BASE" \
  CLERK_SECRET_KEY="$CLERK_SECRET_KEY" \
  STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" \
  STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" \
  POSTMARK_API_TOKEN="$POSTMARK_API_TOKEN" \
  OPENAI_API_KEY="$OPENAI_API_KEY" \
  CORS_ORIGINS="https://listygifty.com,https://www.listygifty.com" \
  FRONTEND_URL="https://listygifty.com" \
  ALLOWED_HOSTS="listygifty-api-prod.fly.dev,api.listygifty.com"

fly secrets set -a listygifty-web-prod --stage \
  CLERK_SECRET_KEY="$CLERK_SECRET_KEY" \
  APP_BASE="$APP_BASE" \
  STRIPE_PUBLIC_KEY="$STRIPE_PUBLIC_KEY"

cd ~/bliss/listygifty
fly deploy --config apps/api/fly.production.toml --remote-only --wait-timeout 600
fly deploy --config apps/web/fly.production.toml --remote-only --wait-timeout 600
```

Run the smoke script (see 3.5) against the `*.fly.dev` URLs — must pass before the real cutover.

### 3.3 T+0 — Enable maintenance mode on Cloud Run

Add a maintenance flag to the prod Cloud Run API. Fastest is to update an env var the app reads:

```bash
gcloud run services update listygifty-api-prod --region=us-central1 \
  --update-env-vars MAINTENANCE_MODE=true
# expect: "Service [listygifty-api-prod] revision ... has been deployed"
```

Requires the API to honor `MAINTENANCE_MODE`. Add a `before_action` once during Phase 0 in `app/controllers/application_controller.rb`:
```ruby
before_action :check_maintenance
private
def check_maintenance
  return unless ENV["MAINTENANCE_MODE"] == "true"
  render json: { error: "maintenance" }, status: 503
end
```

Web app: deploy a maintenance page version, or push Cloudflare worker page rule.

### ✅ T+2 — verify writes blocked
```bash
curl -sS -o /dev/null -w "%{http_code}" -X POST https://api.listygifty.com/v1/lists
# expect: 503
```

### 3.4 T+2 → T+15 — final dump + restore

```bash
# Final dump (same as 2.1)
cloud-sql-proxy listygifty:us-central1:niftygifty-postgres-central --port 5433 &
PROXY_PID=$!
sleep 5
FINAL_DUMP=/tmp/lg-prod-final-$(date +%Y%m%d-%H%M%S).dump
PGPASSWORD="$PG_PASS" pg_dump --no-owner --no-acl --format=custom \
  -h 127.0.0.1 -p 5433 -U "$PG_USER" -d "$PG_DB" -f "$FINAL_DUMP"
kill $PROXY_PID

# Restore into MAIN Neon prod branch (not dry-run)
pg_restore -d "$NEON_PRODUCTION_URL" --no-owner --no-acl -j 4 --clean --if-exists "$FINAL_DUMP"

# Row-count verification (same as 2.3)
diff <(...same query gcp...) <(...same query neon prod...)
# expect: no output
```

### 3.5 T+15 → T+20 — final blob delta + DNS flip

```bash
# Incremental rclone — only copies new/changed objects since dry-run sync
rclone sync gcs-listygifty:listygifty-active-storage-production tigris-prod:listygifty-prod-storage \
  --progress --checksum --transfers 16
# expect: small delta, completes in <5 min

# Switch prod API to MAIN Neon URL (was on dry-run branch)
fly secrets set -a listygifty-api-prod DATABASE_URL="$NEON_PRODUCTION_URL"
# expect: triggers redeploy; wait for healthy
fly status -a listygifty-api-prod | grep -c "started"
# expect: ≥2 (web + worker machines)

# Provision Fly TLS certs (do this BEFORE DNS flip so cert is ready)
fly certs create -a listygifty-api-prod api.listygifty.com
fly certs create -a listygifty-web-prod listygifty.com
fly certs create -a listygifty-web-prod www.listygifty.com

# Get Fly's IPv4 + IPv6 for each app
API_V4=$(fly ips list -a listygifty-api-prod --json | jq -r '.[] | select(.Type=="v4") | .Address')
API_V6=$(fly ips list -a listygifty-api-prod --json | jq -r '.[] | select(.Type=="v6") | .Address')
WEB_V4=$(fly ips list -a listygifty-web-prod --json | jq -r '.[] | select(.Type=="v4") | .Address')
WEB_V6=$(fly ips list -a listygifty-web-prod --json | jq -r '.[] | select(.Type=="v6") | .Address')

# Flip DNS (Cloudflare example)
update_dns() {
  local host=$1 v4=$2 v6=$3
  for rec_type in A AAAA; do
    REC_ID=$(curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=$host&type=$rec_type" \
      | jq -r '.result[0].id')
    val=$([ "$rec_type" = "A" ] && echo "$v4" || echo "$v6")
    curl -sS -X PUT \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -H "Content-Type: application/json" \
      --data "{\"type\":\"$rec_type\",\"name\":\"$host\",\"content\":\"$val\",\"ttl\":60,\"proxied\":false}" \
      "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$REC_ID" | jq .success
    # expect: true
  done
}
update_dns api.listygifty.com "$API_V4" "$API_V6"
update_dns listygifty.com "$WEB_V4" "$WEB_V6"
update_dns www.listygifty.com "$WEB_V4" "$WEB_V6"
```

### 3.6 T+25 — smoke tests

Write `~/bliss/listygifty/.claude/plans/scripts/smoke-prod.sh` (chmod +x):

```bash
#!/usr/bin/env bash
set -euo pipefail
API=https://api.listygifty.com
WEB=https://listygifty.com
PASS=0; FAIL=0
check() {
  local name=$1 url=$2 want=$3
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 --resolve "$(echo $url | sed 's|https://||'):443:$(dig +short $(echo $url | sed 's|https://||') | head -1)" "$url" || echo 000)
  if [ "$code" = "$want" ]; then echo "  ✓ $name ($code)"; PASS=$((PASS+1))
  else echo "  ✗ $name: expected $want got $code"; FAIL=$((FAIL+1)); fi
}
check "API /up"        "$API/up"        200
check "API /holidays"  "$API/holidays"  401
check "web /"          "$WEB/"          200
check "web /login"     "$WEB/login"     200
check "web /signup"    "$WEB/signup"    200
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
```

```bash
~/bliss/listygifty/.claude/plans/scripts/smoke-prod.sh
# expect: exit 0, PASS=5 FAIL=0
```

### 3.7 T+30 — lift maintenance

```bash
gcloud run services update listygifty-api-prod --region=us-central1 \
  --remove-env-vars MAINTENANCE_MODE
```

Actually: by now DNS has flipped, so Cloud Run is no longer receiving traffic. The flag matters only if rollback is triggered. Leave it set; rollback procedure unsets it.

### ✅ Phase 3 exit criteria (run T+30 and again at T+24h)

```bash
# Stripe webhooks delivered post-cutover
fly logs -a listygifty-api-prod --since 1h | grep -c "stripe.*webhook.*200"
# expect: ≥1

# Clerk webhooks delivered post-cutover
fly logs -a listygifty-api-prod --since 1h | grep -c "clerk.*200"
# expect: ≥1

# Postmark send works
fly ssh console -a listygifty-api-prod -C \
  "bin/rails runner 'TestMailer.smoke.deliver_now'"
# expect: no exception; check inbox

# Solid Queue ran a real job after cutover
fly ssh console -a listygifty-api-prod -C \
  "bin/rails runner 'puts SolidQueue::Job.where(\"finished_at > NOW() - INTERVAL 1 HOUR\").count'"
# expect: ≥1

# Zero 500s
fly logs -a listygifty-api-prod --since 30m | grep -cE " 5[0-9]{2} "
# expect: 0

# Cloud Run prod traffic dropped to zero
gcloud run services describe listygifty-api-prod --region=us-central1 \
  --format='value(status.traffic[0].percent)'
gcloud monitoring metrics list --filter="metric.type:run.googleapis.com/request_count" \
  --format=json | jq '.[] | select(.resource.labels.service_name=="listygifty-api-prod")'
# expect: requests trending to 0 over 30 min
```

### 🚨 Rollback (if any exit criterion fails in first hour)

```bash
# 1. Flip DNS back (Cloud Run domain mappings still exist)
update_dns api.listygifty.com "$ORIGINAL_CLOUDRUN_API_IP" "..."
update_dns listygifty.com "$ORIGINAL_CLOUDRUN_WEB_IP" "..."
update_dns www.listygifty.com "$ORIGINAL_CLOUDRUN_WEB_IP" "..."

# 2. Lift Cloud Run maintenance mode
gcloud run services update listygifty-api-prod --region=us-central1 \
  --remove-env-vars MAINTENANCE_MODE

# 3. Verify rollback
curl -sS -o /dev/null -w "%{http_code}" https://api.listygifty.com/up
# expect: 200, served by Cloud Run (check via response header `x-served-by` or trace)
```

🛑 **DATA LOSS NOTE:** Any writes that hit Neon between cutover and rollback are lost when rolling back to Cloud SQL. This is why maintenance mode + paused webhooks + tight window matter. Pause Stripe + Clerk webhooks before T+0 if window will exceed 30 min.

🛑 **HUMAN GATE before rollback:** Get Kent's confirmation. Rollback is a non-trivial DNS reversion and may itself take 5-10 min to propagate.

---

## Phase 4 — Decommission GCP (T+14 days)

```bash
# 4.1 Scale Cloud Run to 0 (cost stops, config remains)
gcloud run services update listygifty-api-prod --region=us-central1 --min-instances=0 --max-instances=0
gcloud run services update listygifty-web-prod --region=us-central1 --min-instances=0 --max-instances=0

# 4.2 Final Cloud SQL backup → GCS coldline
gcloud sql backups create --instance=niftygifty-postgres-central --description="pre-decommission-$(date +%Y%m%d)"

# 4.3 Wait 14 days then delete
gcloud run services delete listygifty-api-prod --region=us-central1 --quiet
gcloud run services delete listygifty-web-prod --region=us-central1 --quiet
gcloud run jobs delete listygifty-migrate-prod --region=us-central1 --quiet
gcloud sql instances delete niftygifty-postgres-central --quiet

# 4.4 GCS bucket → coldline + delete after 90d (via lifecycle rule)
gsutil lifecycle set ~/bliss/listygifty/.claude/plans/scripts/gcs-coldline-lifecycle.json \
  gs://listygifty-active-storage-production

# 4.5 Remove old infra from repo
cd ~/bliss/listygifty
git mv infra/gcp infra/gcp.archived
git mv infra/pulumi infra/pulumi.archived
git mv deploy/cloudbuild*.yaml deploy/.archived/
git tag gcp-archive
git push origin gcp-archive
```

Update `CLAUDE.md`:
```bash
cat > ~/bliss/listygifty/CLAUDE.md <<'MD'
# Claude Deployment Notes — Fly + Neon

## Deploy
- Staging: `fly deploy --config apps/api/fly.staging.toml --remote-only`
- Production: `fly deploy --config apps/api/fly.production.toml --remote-only`
- (Same pattern for `apps/web/`.)

## Postgres (Neon)
- Console: https://console.neon.tech
- Branching: `neonctl branches create --project-id <id> --name <branch>`

## Blob storage (Tigris)
- Bucket per env, attached at app create. Secrets live in Fly secrets.

## Rotating secrets
`fly secrets set -a <app> KEY=value` — triggers redeploy.
MD
```

### ✅ Phase 4 exit criteria

```bash
# Billing < $5 for 1 month
gcloud billing accounts list
gcloud beta billing projects describe listygifty
# Check console for actual monthly spend → expect < $5

# No remaining live GCP services
gcloud run services list --region=us-central1 | grep -c listygifty   # expect: 0
gcloud sql instances list | grep -c niftygifty                       # expect: 0

# Repo grep finds only archived references
grep -rE "gcloud|listygifty-active-storage|cloudrunv2" \
  ~/bliss/listygifty/apps ~/bliss/listygifty/infra \
  --exclude-dir=node_modules --exclude-dir=.archived | wc -l
# expect: 0 (or only archive paths)
```

---

## Appendix A — Cost projection

| Component | GCP today | Fly + Neon target |
|---|---|---|
| API (min=1, prod) | ~$25/mo | ~$5/mo |
| Web (min=1, prod) | ~$15/mo | ~$5/mo |
| Postgres | ~$15-25/mo (Cloud SQL min) | $0-19/mo (Neon Launch) |
| Blob | ~$2-5/mo | ~$1-3/mo (Tigris) |
| Secrets | ~$1/mo | $0 |
| Registry | ~$1/mo | $0 |
| Logs/monitoring | ~$0-10/mo | $0 (Fly built-in) |
| Staging (always-on) | ~$30-40/mo | ~$3-8/mo (scale-to-zero on web) |
| **Prod total** | **~$60-80/mo** | **~$12-35/mo** |
| **Staging total** | **~$35/mo** | **~$5/mo** |

---

## Appendix B — Files this migration creates

- `~/bliss/listygifty/apps/api/fly.staging.toml`
- `~/bliss/listygifty/apps/api/fly.production.toml`
- `~/bliss/listygifty/apps/web/fly.staging.toml`
- `~/bliss/listygifty/apps/web/fly.production.toml`
- `~/bliss/listygifty/.claude/plans/migration-inputs.env` (gitignored)
- `~/bliss/listygifty/.claude/plans/secrets/{staging,production}.env` (gitignored)
- `~/bliss/listygifty/.claude/plans/scripts/smoke-prod.sh`
- Edits: `apps/api/Gemfile`, `apps/api/config/storage.yml`, `apps/api/config/environments/{staging,production}.rb`, `apps/api/app/controllers/application_controller.rb`

Add to `.gitignore`:
```
.claude/plans/migration-inputs.env
.claude/plans/secrets/
```
