# Performance tracing plan

## What changed in this pass

- Added a single authenticated `/bootstrap` API endpoint for startup data.
- Added `Server-Timing` headers on `/bootstrap` so the browser can show server-side phase timings.
- Removed redundant web startup calls for `/profile/sync`, `/billing/status`, `/workspaces`, `/holidays`, `/people`, and `/gifts` on dashboard load.
- Changed mobile shell warmup from multiple independent requests to one bootstrap request that seeds resource caches.

## Primary goals

- Keep authenticated startup to one API round trip in the common case.
- Measure startup from user-visible render, not just backend latency.
- Separate edge latency, app latency, and database latency so bottlenecks are obvious.

## Key metrics to track

### Web

- `navigation to first useful dashboard render`
- `bootstrap request total duration`
- `bootstrap server phases from Server-Timing`
- `number of API requests during initial authenticated navigation`
- `number of CORS preflights during initial authenticated navigation`

### Mobile

- `app launch to first visible list screen`
- `bootstrap request total duration`
- `cache hit ratio for shell data`
- `number of network requests before first interactive tab`

### Backend

- Cloud Run request latency for `GET /bootstrap`
- Cloud Run request latency for remaining hot endpoints
- Cloud Run instance count and cold start rate
- Cloud SQL CPU, memory, active connections, and query latency

## Recommended instrumentation

### 1. Bootstrap as the main startup SLI

Treat `GET /bootstrap` as the main startup service-level indicator.

- Track p50, p95, and p99 latency.
- Break it down by the `Server-Timing` phases:
  - `workspaces`
  - `billing`
  - `holiday_templates`
  - `holidays`
  - `people`
  - `gift_statuses`
  - `gift_exchanges`
  - `pending_gift_total`
  - `pending_gifts`

### 2. Browser RUM

Capture these measurements in the web app and send them to PostHog when configured:

- `app_bootstrap_start`
- `app_bootstrap_end`
- `app_bootstrap_duration_ms`
- `dashboard_first_content_duration_ms`
- `initial_api_request_count`
- `initial_preflight_count`

Use `performance.mark` and `performance.measure` around the bootstrap request and first dashboard paint.

### 3. Mobile client timings

Capture these measurements in the mobile app and emit them to analytics/logging:

- `mobile_bootstrap_start`
- `mobile_bootstrap_end`
- `mobile_bootstrap_duration_ms`
- `mobile_first_tab_ready_duration_ms`
- `mobile_shell_cache_hit`

## GCP dashboards to add

### Cloud Run

- Request count by route
- p50/p95/p99 latency by route
- cold starts inferred from instance creation spikes
- max instances reached

### Cloud SQL

- CPU utilization
- memory utilization
- active connections / backends
- disk latency
- slow query count if Query Insights is enabled

## Logging and tracing

### Request logs

Add log-based views for:

- `/bootstrap`
- `/billing/status`
- `/workspaces`
- `/holidays`
- `/people`
- `/gifts`

Track both request count and latency drift weekly.

### Query Insights

Enable Cloud SQL Query Insights if it is not already enabled.

- Use it to confirm whether `people`, `holidays`, or pending gift queries regress over time.
- Review top queries after each release that affects startup.

## Alert thresholds

- `/bootstrap` p95 above `800ms` for 15 minutes
- `/bootstrap` p99 above `1500ms` for 15 minutes
- Cloud Run cold starts above normal baseline for 30 minutes
- Cloud SQL CPU above `60%` sustained for 15 minutes
- Cloud SQL active connections above `70%` of safe capacity for 15 minutes

## Next infrastructure steps

### Immediate

- Set production web Cloud Run `min-instances=1` to remove web cold starts.

### Near term

- Move Cloud SQL off `db-f1-micro` once startup traces are in place so the upgrade is measurable.
- Consider same-origin API proxying for web if CORS preflights remain material after bootstrap consolidation.

## Regression review checklist

- Did authenticated dashboard load exceed one startup API call?
- Did mobile cold launch fan out into endpoint-by-endpoint fetching?
- Did `/bootstrap` phase timings shift meaningfully?
- Did any page reintroduce client-side parallel startup fetching outside the service layer?
