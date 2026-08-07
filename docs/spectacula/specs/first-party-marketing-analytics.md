# First-Party Marketing Analytics and MCP Suite Specification

Status: Approved for implementation by delegated judgment
Purpose: Replace third-party product analytics with first-party behavioral, attribution, funnel, and marketing-spend data that the Listy Gifty admin MCP can query and interpret.
Audience: Product engineering, growth/marketing operations, and the sole Listy Gifty administrator.

## 1. Problem and Goals

Listy Gifty currently sends web and mobile product events to PostHog. The web app also delegates automatic pageviews to the PostHog SDK. This creates an external analytics dependency, leaves the admin MCP without direct access to raw marketing data, and makes questions about acquisition, landing pages, funnels, campaigns, and individual journeys dependent on a separate dashboard.

V1 will make the Rails/PostgreSQL application the analytics system of record. It will capture pageviews and the existing activation-event dictionary, preserve first- and last-touch attribution, accept marketing spend, and expose structured reports plus raw evidence through the separately authenticated admin MCP.

Goals:

- Remove PostHog client/server packages, initialization, providers, configuration, and deployment secrets. No GA or Mixpanel integration is introduced.
- Capture all consenting web pageviews, mobile screen views, and existing named activation events into PostgreSQL.
- Persist anonymous visitor and session identity across navigation and associate prior anonymous activity when the visitor authenticates.
- Capture UTM parameters, click IDs, referrer, landing page, and a deterministic acquisition channel.
- Answer overview, acquisition, campaign, landing-page, event, funnel, retention, and user-journey questions through admin MCP tools.
- Store daily marketing spend so MCP answers can calculate CAC/CPA instead of reporting conversions without cost context.
- Keep analytics collection non-blocking for users and protect the ingestion endpoint from unbounded payloads and obvious abuse.

Non-goals:

- Session replay, heatmaps, feature flags, A/B assignment, ad-network API synchronization, cross-device fingerprinting, or raw IP retention.
- Importing historical PostHog data. Existing product database timestamps remain available, but first-party behavioral history begins at rollout.
- A graphical analytics dashboard. MCP is the first reporting surface.
- Automated LLM-written conclusions inside Rails; services return metrics, definitions, comparisons, and evidence for the MCP client to interpret.

## 2. Architecture

The system consists of:

1. A public-but-rate-limited `POST /analytics/events` batch ingestion endpoint with optional Clerk authentication.
2. Web and mobile first-party clients using the shared service layer.
3. `AnalyticsEvent` as the immutable fact table and `AnalyticsVisitor` as the identity/attribution state.
4. `MarketingSpend` as daily campaign cost input.
5. `Analytics::QueryService` for reusable metric calculations.
6. Admin MCP tools that validate bounded query windows and audit sensitive/raw access.

The ordinary `/mcp` endpoint never receives global analytics tools. Only `/admin/mcp` can query analytics.

## 3. Data Model

### 3.1 Analytics visitors

`analytics_visitors` contains a stable random `anonymous_id`, optional associated `user_id`, first/last seen timestamps, first/last landing page and referrer, first/last channel, and first/last UTM/click-attribution JSON. Associating an authenticated request updates previously anonymous events for that ID with the user ID, joining pre-signup behavior to later conversion without fingerprinting.

### 3.2 Analytics events

| Field | Contract |
|---|---|
| `event_id` | Client-generated UUID, unique, used for retry deduplication. |
| `event_name` | Lowercase snake-case identifier, maximum 80 characters. Canonical page events are `page_viewed` and `mobile_screen_viewed`. |
| `occurred_at`, `received_at` | Client occurrence time bounded to 24 hours in the past and 5 minutes in the future; otherwise receipt time is used. |
| `visitor_id`, `anonymous_id`, `session_id` | First-party identity and 30-minute client session. |
| `user_id`, `workspace_id` | Derived only from valid authentication/current workspace, never trusted from event properties. |
| `platform` | `web`, `ios`, `android`, or `unknown`. |
| `path`, `title`, `referrer`, `landing_page` | Navigation context with query strings stripped except stored attribution fields. |
| `channel`, UTM columns, click IDs | Normalized attribution snapshot on the event. |
| `properties` | JSON object, maximum 50 keys and 8 KB serialized; reserved identity keys are removed. |
| `ip_hash`, `user_agent` | Daily salted SHA-256 IP hash and bounded user agent; no raw IP is stored. |

Indexes cover occurrence time, event/time, visitor/time, user/time, session, channel/time, UTM source/campaign, and unique `event_id`. Analytics records are excluded from generic admin CRUD so immutable facts cannot be silently rewritten.

### 3.3 Marketing spend

`marketing_spends` stores date, channel, source, medium, campaign, amount, currency, impressions, clicks, and notes. A unique date/source/medium/campaign key makes imports/upserts idempotent. Admin MCP is the write interface in v1.

## 4. Attribution Rules

The client retains first-touch attribution indefinitely and last-touch attribution for the active acquisition context. Supported parameters are `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `msclkid`, and `ttclid`.

Channel classification precedence:

1. Paid click IDs or paid CPC/PPC/paid-search medium -> `paid_search`.
2. Paid social medium/source -> `paid_social`.
3. Email/newsletter -> `email`.
4. Affiliate/partner -> `affiliate`.
5. Display/banner/CPM -> `display`.
6. Known search referrer with no paid markers -> `organic_search`.
7. Known social referrer -> `organic_social`.
8. Other external referrer -> `referral`.
9. No external referrer or campaign -> `direct`.
10. Otherwise -> `other`.

Reports support `first_touch` and `last_touch`; first touch is the default for acquisition/CAC. Attribution facts remain inspectable in raw event output.

## 5. Ingestion Contract and Privacy

`POST /analytics/events` accepts `{ events: [...] }` with 1-50 events. Each event carries event ID/name, anonymous/session IDs, time, platform, navigation context, attribution, and properties. Valid requests return HTTP 202 with accepted/duplicate/rejected counts. Invalid batches return 422 without partially accepting structurally invalid input; individual duplicate IDs are counted rather than treated as errors.

The endpoint attempts optional Clerk authentication when a bearer token is supplied. Invalid supplied credentials are rejected. Workspace association is accepted only when the authenticated user is a member of the `X-Workspace-ID` workspace.

Web collection honors Global Privacy Control and Do Not Track. It does not use advertising cookies, third-party pixels, fingerprinting, raw IPs, email addresses, gift/list content, or URL query strings as event properties. Anonymous and session IDs live in first-party local storage. Mobile uses an install-scoped random ID in AsyncStorage. Collection failures never block product actions.

Server limits include request-body size, property count/size, string lengths, occurrence-time bounds, event-name format, and Rack Attack throttling. Default retention is 25 months, documented for a future scheduled purge job; V1 does not automatically purge until product policy is finalized.

## 6. Client Instrumentation

### 6.1 Web

The existing `captureWebEvent` API remains stable for callers but sends through a shared first-party analytics service. A client `Analytics` component observes Next.js pathname/search changes and emits one `page_viewed` event per route transition, including title, referrer, normalized path, landing page, and attribution. It queues events briefly and flushes bounded batches; failed delivery is best-effort and silent.

### 6.2 Mobile

`useAnalytics` preserves its callback contract but no longer imports PostHog. It uses the shared service and persistent install/session identity. The root router emits `mobile_screen_viewed` on pathname changes. Screenshot mode suppresses collection. Mobile dependencies and environment keys for PostHog are removed, and the mobile package remains independently installed/tested.

### 6.3 Identity stitching

When an authenticated event arrives for an anonymous ID, its visitor is linked to that user and older events for the same anonymous ID are backfilled with the user ID. If the user's account was created within the previous 24 hours and no synthetic event exists for that visitor/user pair, the server records `user_signed_up` at the user's creation time. This makes acquisition funnels queryable without trusting a client-supplied user ID.

## 7. Marketing Query Semantics

All report windows use inclusive UTC dates and default to the last 30 days. Standard windows are capped at 366 days; raw events and journeys cap result counts. Comparison metrics use the immediately preceding equal-length window.

### 7.1 Admin MCP tools

| Tool | Result |
|---|---|
| `admin_analytics_overview` | Pageviews, sessions, visitors, identified visitors, signups, activated users, paid users, and previous-period percentage deltas. |
| `admin_analytics_acquisition` | First/last-touch breakdown by channel/source/medium/campaign/landing page with visitors, sessions, signups, activation, paid users, conversion rates, spend, CPC, CPA, and CAC where available. |
| `admin_analytics_pages` | Landing/page path views, unique visitors, entrances, exits, bounce rate, signups, and conversion rate. |
| `admin_analytics_funnel` | Ordered 2-10 event steps, actor counts, step conversion, overall conversion, and median time-to-next-step. Supports optional channel/source/campaign/platform filters. |
| `admin_analytics_event_breakdown` | Counts and unique actors for an event grouped by a safe top-level property, platform, channel, source, or campaign. |
| `admin_analytics_event_catalog` | Captured event vocabulary with volume, unique actors, and first/last occurrence. |
| `admin_analytics_retention` | Weekly signup cohorts and week-N returning-actor percentages based on any subsequent event. |
| `admin_analytics_events` | Bounded raw event evidence with filters and cursor pagination; tokens, IP hashes, user agents, and private product content are excluded. |
| `admin_analytics_user_journey` | Chronological event journey for a user or anonymous visitor; requires an audit reason because it is individual-level behavioral data. |
| `admin_upsert_marketing_spend` | Idempotently creates/updates one daily campaign-spend row. |
| `admin_list_marketing_spend` | Returns bounded daily spend rows and totals for campaign reconciliation. |

Reports return a `query` echo, `definitions`, `data_quality` notes, and metrics. The MCP can therefore distinguish zero from unavailable, explain attribution choice, and cite raw counts before interpreting performance.

### 7.2 Metric goals and agentic loop

Marketing and product goals are first-class `AnalyticsMetricGoal` records. A goal stores a metric key, target/comparison, inclusive start and target dates, reporting granularity, bounded segment filters, optional ordered funnel steps, lifecycle status, notes, and creating administrator. Supported goal metrics cover visitors, sessions, pageviews, signups, activated and paid users, visitor-to-signup and signup-to-activation conversion, arbitrary named product-event counts, ordered funnel conversion, and marketing spend.

The admin MCP additionally exposes metric discovery, bounded daily/weekly/monthly time series, goal create/list/update/delete, and bulk goal evaluation. Evaluation returns current value, target, progress, elapsed time, expected pace, on-track/at-risk/achieved state, trend series, and a deterministic next-action interpretation. Every goal mutation and evaluation is audited. This closes the loop from observing performance, to setting a target, measuring pacing, interpreting a gap, and letting an agent recommend or take separately-authorized marketing actions.

Time-series counts are grouped in PostgreSQL rather than materialized in Ruby. Common range/filter paths have composite indexes; conversion series reuse set-based activation queries and bounded funnel windows. Windows remain capped at 366 days, funnel series are restricted to weekly/monthly granularity, and raw event capture remains asynchronous/best-effort so this reporting capability does not add latency to user product actions.

Additional MCP tools are `admin_list_metric_definitions`, `admin_analytics_timeseries`, `admin_create_metric_goal`, `admin_list_metric_goals`, `admin_update_metric_goal`, `admin_delete_metric_goal`, and `admin_evaluate_metric_goals`.

### 7.3 Activation definition

`activated_users` means users who have at least one non-template holiday, at least three people, and at least five gifts, or who own an exchange that reached `active`/`completed`. This is computed from product tables rather than inferred solely from possibly dropped client events.

## 8. Third-Party Removal

Remove `posthog-js`, `posthog-react-native`, and `posthog-ruby`; delete the PostHog initializer/provider/instrumentation import; remove `POSTHOG_*` and `EXPO_PUBLIC_POSTHOG_*` settings from examples, build/deploy plumbing, and documentation. Google Maps typing is unrelated and remains. No GA or Mixpanel code currently exists.

## 9. Failure Handling and Operations

- Event capture is best-effort and never blocks a product mutation or navigation.
- Duplicate `event_id` values are idempotent.
- Reporting rejects invalid date ranges, unknown funnel steps, unsafe property names, and unbounded requests with MCP tool errors.
- Spend amount is non-negative and currency is a normalized three-letter code.
- Query services operate on indexed columns, use database grouping/set-based activation checks, cap goal/time-series windows, and bound JSON-property breakdowns to the top 100 values.
- Sensitive journey/raw-event calls create `AdminAuditEvent` records with filters/reason but no event property payload.
- Stats expose accepted/rejected counts in request responses; Rails logs structural rejection counts without logging event properties.

## 10. Rollout

1. Apply analytics migrations and deploy ingestion/reporting before client changes.
2. Deploy web first-party tracking, then mobile tracking.
3. Verify pageview, UTM, identity stitching, activation events, and MCP reports in production.
4. Remove PostHog secrets after both clients no longer reference them.
5. Historical PostHog data may be exported separately if later required; it is not required for launch.

No production deployment is performed in this implementation run.

## 11. Validation Matrix

- Ingestion: schema bounds, batches, duplicates, optional auth, workspace verification, rate limit, timestamps, IP hashing.
- Attribution: all precedence branches, first/last touch persistence, referrer parsing, query stripping.
- Identity: anonymous capture, authenticated association, prior-event backfill, signup synthesis.
- Web: page transitions, UTM persistence, DNT/GPC opt-out, existing custom-event compatibility, no PostHog bundle.
- Mobile: persistent identity, screen view, existing controller events, screenshot suppression, no PostHog package/provider.
- Reports: overview comparisons, acquisition grouping/cost metrics, pages, ordered funnels, property breakdown, retention, pagination, journey auditing, database-grouped time series, and metric-goal pacing.
- Regression: Rails suite, web lint/typecheck/build, mobile tests/typecheck, root package build, RuboCop, Brakeman, Zeitwerk, and dependency searches.

## 12. Definition of Done

- [x] First-party schema, ingestion, attribution, identity stitching, and privacy bounds are implemented and tested.
- [x] Web pageviews and existing web custom events use first-party capture.
- [x] Mobile screen views and existing mobile custom events use first-party capture.
- [x] PostHog packages, runtime code, environment variables, and deployment requirements are removed.
- [x] Admin MCP supports the marketing/reporting tools, time series, and full metric-goal lifecycle in section 7.
- [x] Raw and individual-level access is bounded, redacted, and audited.
- [x] Marketing spend supports currency-safe CAC/CPA calculations.
- [x] Growth, conversion, product-event, and spend goals can be created, updated, evaluated, and deleted through MCP with audited pacing output.
- [x] Operator/event documentation explains definitions and example MCP questions.
- [x] Relevant API, web, mobile, security, build, and spec-review verification passes.

Verification completed on 2026-08-01: Rails 370 tests/1,674 assertions; mobile 25 suites/174 tests; root/web/mobile build, lint, and type checks; 294-file RuboCop; Zeitwerk; Brakeman with zero warnings; migration status; dependency search; and `git diff --check`. The final spec comparison found no unmet in-scope acceptance item. Production deployment and historical PostHog import remain explicitly out of scope.

## 13. Assumptions Chosen Under Delegated Judgment

- “Remove the need for Google Analytics and Mixpanel” means own the analytics data and remove the actual current dependency, PostHog, as well.
- First-party PostgreSQL storage is appropriate at current product scale; a warehouse/ClickHouse migration can be added when indexed queries or storage volume justify it.
- First-touch is the default acquisition model, while last-touch remains queryable.
- Privacy-respecting DNT/GPC behavior is preferable to attempting literally every pageview.
- Ad spend is entered/imported through MCP in v1; automated ad-platform connectors are deferred.
- Existing PostHog history is not migrated without an explicit later request and credentials.
