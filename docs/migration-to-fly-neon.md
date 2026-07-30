# Migration Plan: GCP -> Fly.io + Neon

**Created:** 2026-06-03
**Revised:** 2026-06-03
**Owner:** Kent
**Target:** Production-only migration with a dry-run branch before cutover

---

## GOAL CONTRACT (read first - for autonomous agents)

**SUCCESS CONDITION:** ListyGifty production is fully served from Fly.io (API + web) and Neon (Postgres), with a verified blob storage path (Tigris after approval, or GCS with valid Fly credentials), all GCP production services scaled to zero after DNS cutover, and the migration branch merged to `main`. Verified by: `scripts/smoke-prod.sh` exits 0, Cloud Run production request_count = 0 for 24 hours, and monthly cost projection in Appendix A confirmed within +/-20%.

**EXECUTION MODE:** Sequential phases 0 -> 4. Do not skip phases. Within a phase, each numbered step must complete and every `# expect:` check must pass before the next step starts. If any check fails, STOP and report the exact command output. Do not retry-loop or attempt creative fixes.

**PRODUCTION-ONLY MODE:** This revised plan intentionally creates and migrates only production resources. It creates no staging Fly apps, no staging Neon databases, no staging DNS records, and no staging mobile/TestFlight build. The existing Rails API and Next.js web app remain separate deployables, so production uses two Fly apps rather than a combined image:
- Fly production apps: `listygifty-api-prod`, `listygifty-web-prod`
- Neon project: `listygifty-production`
- Blob storage: existing GCS bucket until Tigris is explicitly approved or a valid GCS credential is provided
- Public hosts: `api.listygifty.com`, `listygifty.com`, `www.listygifty.com`

**CURRENT EXECUTION STATUS (2026-06-03 16:35 EDT):**
- Fly API app `listygifty-api-prod` is deployed and healthy on `https://listygifty-api-prod.fly.dev`.
- Fly web app `listygifty-web-prod` is deployed and healthy on `https://listygifty-web-prod.fly.dev`.
- Current low-cost Fly shape: one API web Machine, one API worker Machine, and one web Machine, all `shared-cpu-1x@512MB` in `iad`.
- Web image version `deployment-01KT7JF3NHN2Y8GY206DWPJB4Y` is built with `NEXT_PUBLIC_API_URL=https://api.listygifty.com` and `NEXT_PUBLIC_APP_URL=https://listygifty.com`.
- Neon production database has the migrated Cloud SQL production data. Representative counts: `users=6`, `workspaces=7`, `people=72`, `gifts=139`, `schema_migrations=60`.
- The Fly API Machine can read Neon directly (`users=6` via Rails runner), and Solid Queue is connected with no ready, scheduled, or failed backlog.
- Neon database size is about `13 MB`; `active_storage_blobs=0` and `active_storage_attachments=0`.
- Fly certs for `api.listygifty.com`, `listygifty.com`, and `www.listygifty.com` exist but are `Not verified` because DNS still resolves through iwantmyname to Google.
- `scripts/smoke-prod.sh` has been added. Current result before DNS cutover: 6 HTTP checks pass and 6 DNS checks fail, proving the script will not falsely pass while Google still serves the public domains.
- DNS cutover is intentionally deferred per Kent. When ready, update iwantmyname records:
  - `api.listygifty.com` A -> `66.241.124.251`
  - `api.listygifty.com` AAAA -> `2a09:8280:1::11f:178a:0`
  - `listygifty.com` A -> `66.241.124.125`
  - `listygifty.com` AAAA -> `2a09:8280:1::11f:178e:0`
  - `www.listygifty.com` A -> `66.241.124.125`
  - `www.listygifty.com` AAAA -> `2a09:8280:1::11f:178e:0`
- Do not stop GCP production services until DNS resolves to Fly and production-domain smoke tests pass.
- Do not treat `https://api.listygifty.com` or `https://listygifty.com` HTTP success as proof of Fly cutover until `scripts/smoke-prod.sh` passes; those hostnames still currently resolve to Google.

**HARD CONSTRAINTS:**
- 🛑 **Never run Phase 3 (production cutover) without explicit human confirmation in chat.** Phase 3 is a maintenance-window operation requiring Kent's go/no-go. Hold at the start of Phase 3 and prompt.
- 🛑 **Never delete GCP resources before Phase 4.** The 14-day soak after cutover is intentional.
- 🛑 **Never commit files matching** `migration-inputs.env` or `secrets/*.env`; these contain plaintext secrets. Add them to `.gitignore` in Phase 0.
- 🛑 **Never skip a `# expect:` check.** If output does not match, STOP and report.
- 🛑 **Never modify the existing GCP Pulumi stack** during phases 0-3. It is the rollback target.
- 🛑 **Never push to `main`.** All work stays on the `migration/fly-neon` branch. PR to `main` only after Phase 3 stability is proven for >=7 days.
- Use only the commands shown. If a command needs a parameter not yet captured, return to the relevant 🛑 HUMAN GATE.

**HUMAN INPUT GATES (10 total - see top of Phase 0):**
The agent must collect all gate answers before issuing any `fly`, `gcloud`, or `psql` mutation. Gates are explicitly marked 🛑 throughout. Block at each gate; do not guess defaults.

**CHECKPOINT CADENCE (post to chat, then wait):**
- End of Phase 0: one-line summary (2 Fly apps created, 1 Neon production DB reachable, branch pushed). Wait for "go".
- End of Phase 1: one-line summary (production Fly config/code changes committed, secrets staged locally). Wait for "go".
- End of Phase 2: row-count diff result + blob size diff + Fly pre-warm smoke result. Wait for "go".
- Start of Phase 3: 🛑 HARD STOP. Require explicit "begin cutover" message.
- End of Phase 3: exit-criteria results. Do not start Phase 4 until +14 days post-cutover.
- End of Phase 4: GCP final-bill confirmation.

**OUT OF SCOPE (do not do, even if it seems related):**
- Refactoring Rails app code beyond the storage adapter swap and `MAINTENANCE_MODE` flag.
- Upgrading Ruby, Rails, Node, or any gem/npm versions.
- Touching iOS app code.
- Reorganizing the monorepo, Turbo config, or Dockerfiles beyond minimal edits called out.
- Changing Clerk, Stripe, Postmark, or OpenAI configuration.
- Optimizing Postgres schema or running `VACUUM FULL`.

**REPORTING FORMAT (every phase):**
1. Phase name + start time.
2. For each step: command, exit code, last 5 lines of output.
3. For each `# expect:` check: pass/fail + actual value.
4. End-of-phase summary: which exit criteria passed, which failed, next action.

---

## Conventions used in this plan

- `$VAR` - a shell variable the agent must `export` before later steps. Capture commands are shown.
- `# expect: <pattern>` - the line above must produce output matching this. If it does not, **STOP** and report.
- **🛑 HUMAN GATE** - block here, ask Kent the question, do not proceed until answered.
- **✅ CHECK** - verification command; agent must run it and confirm before moving on.
- All paths are absolute. All commands are assumed to run from `~/bliss/listygifty` unless stated.

---

## 🛑 HUMAN GATES - collect answers before Phase 0

The agent must collect these answers from Kent before running any command. Save them to `~/bliss/listygifty/.claude/plans/migration-inputs.env` as `export KEY=value` lines.

| Key | Question | Suggested default |
|---|---|---|
| `FLY_ORG` | Which Fly.io organization should own the production apps? | `personal` |
| `FLY_REGION` | Primary Fly region? | `iad` |
| `NEON_REGION` | Neon region for the production project? | `aws-us-east-1` if using the provided URL, otherwise closest to `iad` |
| `NEON_PLAN_PROD` | Neon plan for production? | `Launch` |
| `NEON_PRODUCTION_URL` | Neon production connection string for the main branch? | `postgresql://...` |
| `BLOB_PROVIDER` | Blob provider for production? | `gcs` until Tigris is explicitly approved |
| `DNS_PROVIDER` | Who manages `listygifty.com` DNS today? | `iwantmyname` |
| `WORKER_TOPOLOGY` | Run Solid Queue in API Machine or dedicated worker Machine? | `dedicated worker Machine` |
| `MAINT_WINDOW_START` | When to run Phase 3 cutover? | Saturday morning local |
| `PROD_API_HOST` | Production API hostname? | `api.listygifty.com` |

Fixed production web hosts in this plan:
```bash
export PROD_WEB_HOST="listygifty.com"
export PROD_WWW_HOST="www.listygifty.com"
```

Run this only after the 10 gate answers are collected:
```bash
dig +short NS listygifty.com
# expect: 2+ nameserver hostnames; map to provider (cloudflare.com -> Cloudflare, awsdns -> Route53, etc.)
```

---

## Phase 0 - Prerequisites + production account shells

### 0.1 Verify tooling installed locally

```bash
for bin in fly gh gcloud git rclone pg_dump pg_restore psql jq curl docker cloud-sql-proxy neonctl; do
  command -v "$bin" >/dev/null || { echo "MISSING: $bin"; exit 1; }
done
echo "all tools present"
# expect: "all tools present"
```

If anything is missing, STOP and report. Do not install tools inside the migration run unless Kent explicitly says to proceed.

### 0.2 Authenticate CLIs

```bash
source ~/bliss/listygifty/.claude/plans/migration-inputs.env
fly auth whoami
# expect: an email

gcloud config configurations activate listygifty
# expect: "Activated [listygifty]."

gcloud auth print-access-token >/dev/null && echo "gcloud token ok"
# expect: "gcloud token ok"

gh auth status
# expect: "Logged in"

neonctl auth status
# expect: logged-in Neon account
```

### 0.3 Verify Neon production project

Neon account/project creation is manual. The project must be:
- Name: `listygifty-production`
- Region: `$NEON_REGION`
- Postgres: 16
- Plan: `$NEON_PLAN_PROD`

The main branch connection string must be saved in `~/bliss/listygifty/.claude/plans/migration-inputs.env`:
```bash
export NEON_PRODUCTION_URL="postgresql://...neon.tech/neondb?sslmode=require"
```

Verify connectivity:
```bash
source ~/bliss/listygifty/.claude/plans/migration-inputs.env
psql "$NEON_PRODUCTION_URL" -c "SELECT version();"
# expect: "PostgreSQL 16.x" in output
```

### 0.4 Create migration branch

```bash
cd ~/bliss/listygifty
git checkout main
git pull
git checkout -b migration/fly-neon
git push -u origin migration/fly-neon
git branch --show-current
# expect: migration/fly-neon
```

### 0.5 Protect local secret files from git

```bash
cd ~/bliss/listygifty
grep -qxF ".claude/plans/migration-inputs.env" .gitignore || echo ".claude/plans/migration-inputs.env" >> .gitignore
grep -qxF ".claude/plans/secrets/" .gitignore || echo ".claude/plans/secrets/" >> .gitignore
grep -nE "^\.claude/plans/(migration-inputs\.env|secrets/)$" .gitignore
# expect: both ignore patterns printed
```

Commit only the `.gitignore` update:
```bash
git add .gitignore
git commit -m "Ignore migration secret files"
# expect: commit created, or no-op only if patterns were already tracked in HEAD
```

### 0.6 Create Fly production apps (empty shells)

```bash
source ~/bliss/listygifty/.claude/plans/migration-inputs.env

for app in listygifty-api-prod listygifty-web-prod; do
  fly apps create "$app" --org "$FLY_ORG" 2>&1 | tee "/tmp/fly-create-$app.log"
done

fly apps list --org "$FLY_ORG" | grep -E "listygifty-(api|web)-prod" | wc -l
# expect: 2
```

### 0.7 Create Tigris production bucket

This production-only plan is written for Tigris. If `BLOB_PROVIDER` is not `tigris`, STOP and revise the plan before running storage commands.

```bash
source ~/bliss/listygifty/.claude/plans/migration-inputs.env
test "$BLOB_PROVIDER" = "tigris" && echo "tigris selected"
# expect: "tigris selected"

fly storage create --name listygifty-prod-storage -a listygifty-api-prod
# expect: prints AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, BUCKET_NAME, AWS_ENDPOINT_URL_S3
```

Capture the printed Tigris values immediately into `~/bliss/listygifty/.claude/plans/secrets/production.env` as:
```bash
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export BUCKET_NAME="listygifty-prod-storage"
export AWS_ENDPOINT_URL_S3="https://fly.storage.tigris.dev"
export AWS_REGION="auto"
```

Then verify Fly has the storage secrets attached:
```bash
fly secrets list -a listygifty-api-prod | grep AWS_
# expect: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3
```

### ✅ Phase 0 exit criteria

Run all of:
```bash
fly apps list --org "$FLY_ORG" | grep -E "listygifty-(api|web)-prod" | wc -l
# expect: 2

psql "$NEON_PRODUCTION_URL" -c "SELECT 1" | grep -c "1 row"
# expect: 1

git -C ~/bliss/listygifty branch --show-current
# expect: migration/fly-neon

test -f ~/bliss/listygifty/.claude/plans/migration-inputs.env && echo OK
# expect: OK

grep -nE "^\.claude/plans/(migration-inputs\.env|secrets/)$" ~/bliss/listygifty/.gitignore | wc -l
# expect: 2
```

Checkpoint: post one-line summary and wait for "go".

---

## Phase 1 - Production app config without DNS traffic

### 1.1 Pull current production secret values from GCP Secret Manager

```bash
source ~/bliss/listygifty/.claude/plans/migration-inputs.env
gcloud config configurations activate listygifty

mkdir -p ~/bliss/listygifty/.claude/plans/secrets
SECRETS_FILE=~/bliss/listygifty/.claude/plans/secrets/production.env
touch "$SECRETS_FILE"
chmod 600 "$SECRETS_FILE"

for slug in clerk-secret-key stripe-secret-key stripe-webhook-secret \
            postmark-api-token openai-api-key allowed-hosts cors-origins \
            frontend-url app-base stripe-public-key; do
  val=$(gcloud secrets versions access latest --secret="niftygifty-${slug}")
  [ -z "$val" ] && { echo "MISSING: $slug"; exit 1; }
  upper=$(echo "$slug" | tr 'a-z-' 'A-Z_')
  grep -q "^export ${upper}=" "$SECRETS_FILE" || printf 'export %s=%q\n' "$upper" "$val" >> "$SECRETS_FILE"
done

rails_key=$(gcloud secrets versions access latest --secret=listygifty-rails-key-prod)
grep -q "^export SECRET_KEY_BASE=" "$SECRETS_FILE" || printf 'export SECRET_KEY_BASE=%q\n' "$rails_key" >> "$SECRETS_FILE"

grep -c "^export " "$SECRETS_FILE"
# expect: 16 or more (11 app secrets plus 5 Tigris values from Phase 0)
```

### 1.2 Add Active Storage S3 adapter to API

```bash
cd ~/bliss/listygifty/apps/api
grep -q "aws-sdk-s3" Gemfile || printf '\n# Tigris / S3-compatible blob storage\ngem "aws-sdk-s3", require: false\n' >> Gemfile
bundle install
grep -n "aws-sdk-s3" Gemfile
# expect: aws-sdk-s3 line
```

Ensure `~/bliss/listygifty/apps/api/config/storage.yml` has:
```yaml
tigris:
  service: S3
  access_key_id: <%= ENV["AWS_ACCESS_KEY_ID"] %>
  secret_access_key: <%= ENV["AWS_SECRET_ACCESS_KEY"] %>
  endpoint: <%= ENV.fetch("AWS_ENDPOINT_URL_S3", "https://fly.storage.tigris.dev") %>
  region: <%= ENV.fetch("AWS_REGION", "auto") %>
  bucket: <%= ENV["BUCKET_NAME"] %>
  force_path_style: true
```

Set production Active Storage to be environment-controlled:
```bash
grep "active_storage.service" ~/bliss/listygifty/apps/api/config/environments/production.rb
# expect: line containing ENV.fetch("ACTIVE_STORAGE_SERVICE"
```

### 1.3 Add production maintenance mode support

Add this once to `~/bliss/listygifty/apps/api/app/controllers/application_controller.rb`:
```ruby
before_action :check_maintenance

private

def check_maintenance
  return unless ENV["MAINTENANCE_MODE"] == "true"
  return if request.get? && request.path == "/up"

  render json: { error: "maintenance" }, status: :service_unavailable
end
```

Verify:
```bash
grep -n "check_maintenance" ~/bliss/listygifty/apps/api/app/controllers/application_controller.rb
# expect: before_action and method definition lines
```

### 1.4 Create `fly.production.toml` for API

Write `~/bliss/listygifty/apps/api/fly.production.toml`:

```toml
app = "listygifty-api-prod"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  RAILS_ENV = "production"
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

Verify:
```bash
grep -E 'app = "listygifty-api-prod"|RAILS_ENV = "production"|ACTIVE_STORAGE_SERVICE = "tigris"' \
  ~/bliss/listygifty/apps/api/fly.production.toml
# expect: all three lines
```

### 1.5 Create `fly.production.toml` for Web

Write `~/bliss/listygifty/apps/web/fly.production.toml`:

```toml
app = "listygifty-web-prod"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"
  [build.args]
    NEXT_PUBLIC_API_URL = "https://api.listygifty.com"
    NEXT_PUBLIC_APP_URL = "https://listygifty.com"
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_live_REPLACE_ME"

[env]
  NODE_ENV = "production"
  PORT = "8080"
  NEXT_TELEMETRY_DISABLED = "1"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "off"
  auto_start_machines = true
  min_machines_running = 1

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

🛑 **HUMAN GATE:** If `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` cannot be pulled from GCP Secret Manager, paste the Clerk production publishable key and replace `pk_live_REPLACE_ME`.

Verify:
```bash
grep -E 'app = "listygifty-web-prod"|NEXT_PUBLIC_API_URL = "https://api.listygifty.com"|pk_live_' \
  ~/bliss/listygifty/apps/web/fly.production.toml
# expect: all three lines, with no REPLACE_ME
```

### 1.6 Commit production config changes

```bash
cd ~/bliss/listygifty
git add apps/api/Gemfile apps/api/Gemfile.lock apps/api/config/storage.yml \
  apps/api/config/environments/production.rb apps/api/app/controllers/application_controller.rb \
  apps/api/fly.production.toml apps/web/fly.production.toml
git commit -m "Add Fly production deployment config"
git status --short
# expect: no migration-related tracked changes left unstaged
```

### ✅ Phase 1 exit criteria

Run all of:
```bash
test -f ~/bliss/listygifty/apps/api/fly.production.toml && echo OK
# expect: OK

test -f ~/bliss/listygifty/apps/web/fly.production.toml && echo OK
# expect: OK

grep -n "ACTIVE_STORAGE_SERVICE" ~/bliss/listygifty/apps/api/fly.production.toml
# expect: ACTIVE_STORAGE_SERVICE = "tigris"

grep -n "check_maintenance" ~/bliss/listygifty/apps/api/app/controllers/application_controller.rb
# expect: before_action and method definition lines

test -f ~/bliss/listygifty/.claude/plans/secrets/production.env && echo OK
# expect: OK
```

Checkpoint: post one-line summary and wait for "go".

---

## Phase 2 - Production dry-run + Fly pre-warm

### 2.1 Capture production DB dump from Cloud SQL

```bash
source ~/bliss/listygifty/.claude/plans/migration-inputs.env
gcloud config configurations activate listygifty

cloud-sql-proxy listygifty:us-central1:niftygifty-postgres-central --port 5433 &
PROXY_PID=$!
sleep 5

PROD_DB_URL=$(gcloud secrets versions access latest --secret=niftygifty-database-url)
PG_USER=$(echo "$PROD_DB_URL" | sed -E 's|postgres://([^:]+):.*|\1|')
PG_PASS=$(echo "$PROD_DB_URL" | sed -E 's|postgres://[^:]+:([^@]+)@.*|\1|')
PG_DB=$(echo "$PROD_DB_URL" | sed -E 's|.*/([^?]+).*|\1|')

DUMP_FILE=/tmp/lg-prod-$(date +%Y%m%d-%H%M%S).dump
PGPASSWORD="$PG_PASS" pg_dump --no-owner --no-acl --format=custom \
  -h 127.0.0.1 -p 5433 -U "$PG_USER" -d "$PG_DB" \
  -f "$DUMP_FILE"

ls -lh "$DUMP_FILE"
# expect: file > 1 MB

printf 'export DUMP=%q\n' "$DUMP_FILE" >> ~/bliss/listygifty/.claude/plans/migration-inputs.env
printf 'export PG_USER=%q\nexport PG_PASS=%q\nexport PG_DB=%q\n' "$PG_USER" "$PG_PASS" "$PG_DB" >> ~/bliss/listygifty/.claude/plans/migration-inputs.env

kill $PROXY_PID
```

### 2.2 Create Neon dry-run branch

```bash
source ~/bliss/listygifty/.claude/plans/migration-inputs.env

NEON_PROJECT_ID=$(neonctl projects list --output json | jq -r '.[] | select(.name=="listygifty-production") | .id')
echo "PROJECT=$NEON_PROJECT_ID"
# expect: non-empty project id

neonctl branches create --project-id "$NEON_PROJECT_ID" --name pg-restore-dryrun
NEON_DRYRUN_URL=$(neonctl connection-string pg-restore-dryrun --project-id "$NEON_PROJECT_ID")
echo "export NEON_DRYRUN_URL=\"$NEON_DRYRUN_URL\"" >> ~/bliss/listygifty/.claude/plans/migration-inputs.env
test -n "$NEON_DRYRUN_URL" && echo OK
# expect: OK
```

### 2.3 Restore into Neon dry-run branch

```bash
source ~/bliss/listygifty/.claude/plans/migration-inputs.env
time pg_restore -d "$NEON_DRYRUN_URL" --no-owner --no-acl -j 4 "$DUMP"
# expect: completes within agreed cutover window (target < 15 min)
```

### 2.4 Verify row counts

```bash
source ~/bliss/listygifty/.claude/plans/migration-inputs.env

cloud-sql-proxy listygifty:us-central1:niftygifty-postgres-central --port 5433 &
PROXY_PID=$!
sleep 5
PGPASSWORD="$PG_PASS" psql -h 127.0.0.1 -p 5433 -U "$PG_USER" -d "$PG_DB" \
  -A -F, -t -c "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname" \
  > /tmp/counts-gcp.csv
kill $PROXY_PID

psql "$NEON_DRYRUN_URL" \
  -A -F, -t -c "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname" \
  > /tmp/counts-neon.csv

diff /tmp/counts-gcp.csv /tmp/counts-neon.csv
# expect: no output (identical)
```

If `n_live_tup` drifts because stats lag, use deterministic counts:
```bash
cloud-sql-proxy listygifty:us-central1:niftygifty-postgres-central --port 5433 &
PROXY_PID=$!
sleep 5
PGPASSWORD="$PG_PASS" psql -h 127.0.0.1 -p 5433 -U "$PG_USER" -d "$PG_DB" -t -c "
  SELECT 'users', COUNT(*) FROM users UNION ALL
  SELECT 'lists', COUNT(*) FROM lists UNION ALL
  SELECT 'gifts', COUNT(*) FROM gifts UNION ALL
  SELECT 'subscriptions', COUNT(*) FROM subscriptions
" > /tmp/exact-gcp.txt
kill $PROXY_PID

psql "$NEON_DRYRUN_URL" -t -c "
  SELECT 'users', COUNT(*) FROM users UNION ALL
  SELECT 'lists', COUNT(*) FROM lists UNION ALL
  SELECT 'gifts', COUNT(*) FROM gifts UNION ALL
  SELECT 'subscriptions', COUNT(*) FROM subscriptions
" > /tmp/exact-neon.txt

diff /tmp/exact-gcp.txt /tmp/exact-neon.txt
# expect: no output
```

### 2.5 Active Storage blob dry-run sync

Ensure `~/.config/rclone/rclone.conf` has remotes for GCS and Tigris. Use the Tigris values captured at Phase 0; never try to read secret values from `fly secrets list`.

```bash
rclone size gcs-listygifty:listygifty-active-storage-production > /tmp/gcs-size.txt
cat /tmp/gcs-size.txt
# expect: prints object count and total bytes

rclone sync gcs-listygifty:listygifty-active-storage-production tigris-prod:listygifty-prod-storage \
  --progress --checksum --transfers 16 2>&1 | tee /tmp/rclone-initial.log

rclone size tigris-prod:listygifty-prod-storage > /tmp/tigris-size.txt
diff /tmp/gcs-size.txt /tmp/tigris-size.txt
# expect: no output (identical object counts and bytes)
```

### 2.6 Push Fly secrets using Neon production URL

```bash
source ~/bliss/listygifty/.claude/plans/migration-inputs.env
source ~/bliss/listygifty/.claude/plans/secrets/production.env

fly secrets set -a listygifty-api-prod --stage \
  DATABASE_URL="$NEON_PRODUCTION_URL" \
  SECRET_KEY_BASE="$SECRET_KEY_BASE" \
  CLERK_SECRET_KEY="$CLERK_SECRET_KEY" \
  STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" \
  STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" \
  POSTMARK_API_TOKEN="$POSTMARK_API_TOKEN" \
  OPENAI_API_KEY="$OPENAI_API_KEY" \
  CORS_ORIGINS="https://${PROD_WEB_HOST},https://${PROD_WWW_HOST}" \
  FRONTEND_URL="https://${PROD_WEB_HOST}" \
  ALLOWED_HOSTS="listygifty-api-prod.fly.dev,${PROD_API_HOST}" \
  ACTIVE_STORAGE_SERVICE="google" \
  ACTIVE_STORAGE_BUCKET="listygifty-active-storage-production" \
  GOOGLE_CLOUD_PROJECT="listygifty"

fly secrets set -a listygifty-web-prod --stage \
  CLERK_SECRET_KEY="$CLERK_SECRET_KEY" \
  APP_BASE="$APP_BASE" \
  STRIPE_PUBLIC_KEY="$STRIPE_PUBLIC_KEY"

fly secrets list -a listygifty-api-prod | awk 'NR>1 {print $1}' | sort
# expect: ACTIVE_STORAGE_BUCKET, ACTIVE_STORAGE_SERVICE, ALLOWED_HOSTS,
#         CLERK_SECRET_KEY, CORS_ORIGINS, DATABASE_URL, FRONTEND_URL,
#         GOOGLE_CLOUD_PROJECT, OPENAI_API_KEY, POSTMARK_API_TOKEN,
#         SECRET_KEY_BASE, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
```

### 2.7 Deploy production Fly apps without DNS traffic

```bash
cd ~/bliss/listygifty/apps/api
fly deploy --config fly.production.toml --remote-only --wait-timeout 600 --ha=false
# expect: API web Machine healthy and API worker Machine started

cd ~/bliss/listygifty
source .claude/plans/secrets/production.env
fly deploy . \
  --config apps/web/fly.production.toml \
  --dockerfile apps/web/Dockerfile \
  --remote-only \
  --wait-timeout 600 \
  --ha=false \
  --build-arg NEXT_PUBLIC_API_URL=https://api.listygifty.com \
  --build-arg NEXT_PUBLIC_APP_URL=https://listygifty.com \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$CLERK_PUBLISHABLE_KEY"
# expect: one web Machine healthy
```

### 2.8 Pre-warm verification against `*.fly.dev`

```bash
API_URL="https://listygifty-api-prod.fly.dev"
WEB_URL="https://listygifty-web-prod.fly.dev"

curl -sS -o /dev/null -w "%{http_code}" "$API_URL/up"
# expect: 200

curl -sS -o /dev/null -w "%{http_code}" "$API_URL/holidays"
# expect: 401

fly ssh console -a listygifty-api-prod -C "bin/rails db:migrate:status" | grep -c "down"
# expect: 0

fly machine list -a listygifty-api-prod --json | jq -r '.[].config.metadata.fly_process_group' | sort -u
# expect: lines including "web" and "worker"

fly ssh console -a listygifty-api-prod -C "bin/rails runner \"
  blob = ActiveStorage::Blob.create_and_upload!(
    io: StringIO.new('hello tigris'),
    filename: 'smoketest.txt',
    content_type: 'text/plain'
  )
  puts blob.url(expires_in: 5.minutes)
\"" | tail -1 > /tmp/blob_url.txt
curl -sS "$(cat /tmp/blob_url.txt)" | grep -c "hello tigris"
# expect: 1

curl -sS -o /dev/null -w "%{http_code}" "$WEB_URL/"
# expect: 200

curl -sS -o /dev/null -w "%{http_code}" "$WEB_URL/login"
# expect: 200
```

### 2.9 Provision Fly TLS certs and lower DNS TTL

```bash
source ~/bliss/listygifty/.claude/plans/migration-inputs.env

fly certs create -a listygifty-api-prod "$PROD_API_HOST"
fly certs create -a listygifty-web-prod "$PROD_WEB_HOST"
fly certs create -a listygifty-web-prod "$PROD_WWW_HOST"

fly certs list -a listygifty-api-prod | grep "$PROD_API_HOST"
# expect: hostname listed
fly certs list -a listygifty-web-prod | grep -E "$PROD_WEB_HOST|$PROD_WWW_HOST" | wc -l
# expect: 2
```

🛑 **HUMAN GATE:** Lower DNS TTLs on `api.listygifty.com`, `listygifty.com`, and `www.listygifty.com` to 60 seconds at `$DNS_PROVIDER`.

For Cloudflare only, if `CLOUDFLARE_API_TOKEN` is exported:
```bash
ZONE_ID=$(curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones?name=listygifty.com" | jq -r '.result[0].id')

for host in "$PROD_API_HOST" "$PROD_WEB_HOST" "$PROD_WWW_HOST"; do
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

### ✅ Phase 2 exit criteria

- [ ] Diff on row counts returns empty.
- [ ] Diff on object counts/bytes returns empty.
- [ ] Fly production apps deployed against `NEON_DRYRUN_URL`.
- [ ] API and web smoke checks pass on `*.fly.dev`.
- [ ] TLS certs requested for all three production hostnames.
- [ ] DNS TTLs lowered to 60 seconds.

Checkpoint: post summary and wait for "go".

---

## Phase 3 - Production cutover

🛑 **HARD STOP:** Do not run any Phase 3 command until Kent replies exactly: `begin cutover`.

### 3.1 Enable maintenance mode on current Cloud Run API

```bash
gcloud run services update listygifty-api-prod --region=us-central1 \
  --update-env-vars MAINTENANCE_MODE=true
# expect: "Service [listygifty-api-prod] revision ... has been deployed"
```

Verify writes are blocked:
```bash
curl -sS -o /dev/null -w "%{http_code}" -X POST "https://api.listygifty.com/lists"
# expect: 503
```

### 3.2 Final production DB dump

```bash
source ~/bliss/listygifty/.claude/plans/migration-inputs.env

cloud-sql-proxy listygifty:us-central1:niftygifty-postgres-central --port 5433 &
PROXY_PID=$!
sleep 5

FINAL_DUMP=/tmp/lg-prod-final-$(date +%Y%m%d-%H%M%S).dump
PGPASSWORD="$PG_PASS" pg_dump --no-owner --no-acl --format=custom \
  -h 127.0.0.1 -p 5433 -U "$PG_USER" -d "$PG_DB" -f "$FINAL_DUMP"
ls -lh "$FINAL_DUMP"
# expect: file > 1 MB

kill $PROXY_PID
```

### 3.3 Restore final dump into main Neon production branch

```bash
source ~/bliss/listygifty/.claude/plans/migration-inputs.env

time pg_restore -d "$NEON_PRODUCTION_URL" --no-owner --no-acl -j 4 --clean --if-exists "$FINAL_DUMP"
# expect: completes within agreed cutover window (target < 15 min)
```

Verify row counts:
```bash
cloud-sql-proxy listygifty:us-central1:niftygifty-postgres-central --port 5433 &
PROXY_PID=$!
sleep 5
PGPASSWORD="$PG_PASS" psql -h 127.0.0.1 -p 5433 -U "$PG_USER" -d "$PG_DB" -t -c "
  SELECT 'users', COUNT(*) FROM users UNION ALL
  SELECT 'lists', COUNT(*) FROM lists UNION ALL
  SELECT 'gifts', COUNT(*) FROM gifts UNION ALL
  SELECT 'subscriptions', COUNT(*) FROM subscriptions
" > /tmp/final-gcp.txt
kill $PROXY_PID

psql "$NEON_PRODUCTION_URL" -t -c "
  SELECT 'users', COUNT(*) FROM users UNION ALL
  SELECT 'lists', COUNT(*) FROM lists UNION ALL
  SELECT 'gifts', COUNT(*) FROM gifts UNION ALL
  SELECT 'subscriptions', COUNT(*) FROM subscriptions
" > /tmp/final-neon.txt

diff /tmp/final-gcp.txt /tmp/final-neon.txt
# expect: no output
```

### 3.4 Final blob delta sync

```bash
rclone sync gcs-listygifty:listygifty-active-storage-production tigris-prod:listygifty-prod-storage \
  --progress --checksum --transfers 16
# expect: small delta, completes in <5 min

rclone size gcs-listygifty:listygifty-active-storage-production > /tmp/gcs-size-final.txt
rclone size tigris-prod:listygifty-prod-storage > /tmp/tigris-size-final.txt
diff /tmp/gcs-size-final.txt /tmp/tigris-size-final.txt
# expect: no output
```

### 3.5 Switch Fly API from dry-run branch to main Neon production URL

```bash
source ~/bliss/listygifty/.claude/plans/migration-inputs.env

fly secrets set -a listygifty-api-prod DATABASE_URL="$NEON_PRODUCTION_URL"
# expect: triggers redeploy; wait for healthy

fly status -a listygifty-api-prod | grep -c "started"
# expect: >=2 (web + worker machines)
```

### 3.6 Flip production DNS to Fly

```bash
source ~/bliss/listygifty/.claude/plans/migration-inputs.env

API_V4=$(fly ips list -a listygifty-api-prod --json | jq -r '.[] | select(.Type=="v4") | .Address')
API_V6=$(fly ips list -a listygifty-api-prod --json | jq -r '.[] | select(.Type=="v6") | .Address')
WEB_V4=$(fly ips list -a listygifty-web-prod --json | jq -r '.[] | select(.Type=="v4") | .Address')
WEB_V6=$(fly ips list -a listygifty-web-prod --json | jq -r '.[] | select(.Type=="v6") | .Address')

test -n "$API_V4" && test -n "$API_V6" && test -n "$WEB_V4" && test -n "$WEB_V6" && echo OK
# expect: OK
```

For Cloudflare only, if `CLOUDFLARE_API_TOKEN` is exported:
```bash
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

update_dns "$PROD_API_HOST" "$API_V4" "$API_V6"
update_dns "$PROD_WEB_HOST" "$WEB_V4" "$WEB_V6"
update_dns "$PROD_WWW_HOST" "$WEB_V4" "$WEB_V6"
```

If `$DNS_PROVIDER` is not Cloudflare, do the equivalent A and AAAA updates manually and paste confirmation before continuing.

### 3.7 Smoke tests

Write `~/bliss/listygifty/scripts/smoke-prod.sh` and `chmod +x` it:

```bash
#!/usr/bin/env bash
set -euo pipefail
API=https://api.listygifty.com
WEB=https://listygifty.com
PASS=0
FAIL=0

check() {
  local name=$1 url=$2 want=$3
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$url" || echo 000)
  if [ "$code" = "$want" ]; then
    echo "PASS $name ($code)"
    PASS=$((PASS+1))
  else
    echo "FAIL $name: expected $want got $code"
    FAIL=$((FAIL+1))
  fi
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
~/bliss/listygifty/scripts/smoke-prod.sh
# expect: exit 0, PASS=5 FAIL=0
```

Commit the smoke script:
```bash
cd ~/bliss/listygifty
git add scripts/smoke-prod.sh
git commit -m "Add production smoke script"
# expect: commit created
```

### 3.8 Exit criteria at T+30 and T+24h

```bash
fly ssh console -a listygifty-api-prod -C \
  "bin/rails runner 'puts SolidQueue::Job.where(\"finished_at > NOW() - INTERVAL 1 HOUR\").count'"
# expect: >=1

fly logs -a listygifty-api-prod --since 30m | grep -cE " 5[0-9]{2} "
# expect: 0

gcloud monitoring metrics list --filter="metric.type:run.googleapis.com/request_count" \
  --format=json | jq '.[] | select(.resource.labels.service_name=="listygifty-api-prod")'
# expect: requests trending to 0 over 30 min
```

Leave Cloud Run `MAINTENANCE_MODE=true` during the rollback window. If rollback is required, remove the env var only after DNS is pointed back to GCP.

### 🚨 Rollback (if any exit criterion fails in first hour)

🛑 **HUMAN GATE before rollback:** Get Kent's confirmation. Rollback is a non-trivial DNS reversion and may itself take 5-10 minutes to propagate.

```bash
# 1. Flip DNS back to the original GCP targets captured before cutover.
# 2. Lift Cloud Run maintenance mode.
gcloud run services update listygifty-api-prod --region=us-central1 \
  --remove-env-vars MAINTENANCE_MODE

# 3. Verify rollback.
curl -sS -o /dev/null -w "%{http_code}" https://api.listygifty.com/up
# expect: 200, served by Cloud Run
```

🛑 **DATA LOSS NOTE:** Any writes that hit Neon between cutover and rollback are lost when rolling back to Cloud SQL. This is why maintenance mode, tight timing, and exit checks matter.

Checkpoint: post Phase 3 exit-criteria results. Do not start Phase 4 until 14 days after Phase 3 completes.

---

## Phase 4 - Decommission GCP (T+14 days)

🛑 **HARD STOP:** Do not run Phase 4 until at least 14 days after Phase 3 completes.

### 4.1 Confirm Cloud Run production request_count was zero for 24 hours

```bash
gcloud monitoring metrics list --filter="metric.type:run.googleapis.com/request_count" \
  --format=json | jq '.[] | select(.resource.labels.service_name=="listygifty-api-prod" or .resource.labels.service_name=="listygifty-web-prod")'
# expect: zero request_count for 24 hours
```

### 4.2 Scale Cloud Run production services to zero

```bash
gcloud run services update listygifty-api-prod --region=us-central1 --min-instances=0 --max-instances=0
gcloud run services update listygifty-web-prod --region=us-central1 --min-instances=0 --max-instances=0
gcloud run services describe listygifty-api-prod --region=us-central1 --format='value(spec.template.metadata.annotations.autoscaling.knative.dev/maxScale)'
# expect: 0
```

### 4.3 Final Cloud SQL backup

```bash
gcloud sql backups create --instance=niftygifty-postgres-central --description="pre-decommission-$(date +%Y%m%d)"
# expect: backup operation started or completed
```

### 4.4 Delete GCP production compute and database resources

```bash
gcloud run services delete listygifty-api-prod --region=us-central1 --quiet
gcloud run services delete listygifty-web-prod --region=us-central1 --quiet
gcloud run jobs delete listygifty-migrate-prod --region=us-central1 --quiet
gcloud sql instances delete niftygifty-postgres-central --quiet
# expect: delete operations complete
```

### 4.5 Preserve GCS objects on coldline lifecycle

```bash
gsutil lifecycle set ~/bliss/listygifty/.claude/plans/scripts/gcs-coldline-lifecycle.json \
  gs://listygifty-active-storage-production
# expect: lifecycle set
```

### 4.6 Archive old GCP infra references after deletion

```bash
cd ~/bliss/listygifty
git mv infra/gcp infra/gcp.archived
git mv infra/pulumi infra/pulumi.archived
git tag gcp-archive
git push origin gcp-archive
# expect: tag pushed
```

Update `CLAUDE.md`:
```markdown
# Claude Deployment Notes - Fly + Neon

## Deploy
- API production: `cd apps/api && fly deploy --config fly.production.toml --remote-only --ha=false`
- Web production: `fly deploy . --config apps/web/fly.production.toml --dockerfile apps/web/Dockerfile --remote-only --ha=false --build-arg NEXT_PUBLIC_API_URL=https://api.listygifty.com --build-arg NEXT_PUBLIC_APP_URL=https://listygifty.com --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$CLERK_PUBLISHABLE_KEY"`

## Postgres (Neon)
- Console: https://console.neon.tech
- Branching: `neonctl branches create --project-id <id> --name <branch>`

## Blob storage
- Current production setting: existing GCS bucket `listygifty-active-storage-production`.
- Uploads need either Tigris approval or a valid GCS credential available to Fly before this is considered fully verified.

## Rotating secrets
`fly secrets set -a <app> KEY=value` triggers redeploy.
```

### ✅ Phase 4 exit criteria

```bash
gcloud billing accounts list
gcloud beta billing projects describe listygifty
# expect: confirm actual monthly GCP spend is under $5 after decommission

gcloud run services list --region=us-central1 | grep -c listygifty
# expect: 0

gcloud sql instances list | grep -c niftygifty
# expect: 0

grep -rE "gcloud|listygifty-active-storage|cloudrunv2" \
  ~/bliss/listygifty/apps ~/bliss/listygifty/infra \
  --exclude-dir=node_modules --exclude-dir=.archived | wc -l
# expect: 0 or only archive paths
```

Checkpoint: post GCP final-bill confirmation.

---

## Appendix A - Cost projection

| Component | GCP today | Fly + Neon target |
|---|---:|---:|
| API production | part of ~$200/mo stack | ~$6.40/mo for API web + worker |
| Web production | part of ~$200/mo stack | ~$3.20/mo for one web Machine |
| Postgres | part of ~$200/mo stack | ~$0-20/mo on Neon depending usage |
| Blob storage | part of ~$200/mo stack | ~$0 now; TBD for Tigris or GCS credential |
| Secrets | ~$1/mo | $0 |
| Registry | ~$1/mo | $0 |
| Logs/monitoring | ~$0-10/mo | $0 basic Fly logs |
| **Production total** | **~$200/mo observed** | **~$10 Fly + ~$0-20 Neon, before bandwidth/storage** |

---

## Appendix B - Files this migration creates or edits

- `~/bliss/listygifty/apps/api/fly.production.toml`
- `~/bliss/listygifty/apps/web/fly.production.toml`
- `~/bliss/listygifty/scripts/smoke-prod.sh`
- `~/bliss/listygifty/.claude/plans/migration-inputs.env` (gitignored)
- `~/bliss/listygifty/.claude/plans/secrets/production.env` (gitignored)
- Edits: `.dockerignore`, `.gitignore`, `docs/migration-to-fly-neon.md`

Add to `.gitignore`:
```gitignore
.claude/plans/migration-inputs.env
.claude/plans/secrets/
```
