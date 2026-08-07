# Listy Gifty Admin MCP

The admin MCP server is a separate HTTP control plane for product-wide statistics, first-party marketing analytics, support inspection, domain-data CRUD, registered-user email, and guarded user deletion.

## Security model

The endpoint is `POST /admin/mcp`. It accepts API keys only—OAuth and Clerk bearer tokens are rejected. A key must:

- be active and unexpired;
- contain the `admin` scope; and
- belong to a user whose normalized email is in `ADMIN_EMAILS`.

Admin keys are dedicated (`admin` is the only scope), expire no later than 30 days after creation, and are accepted only through `Authorization: Bearer ...`. The admin endpoint intentionally rejects `X-API-Key` even though ordinary API endpoints retain that legacy option.

The initial and default allowlist is:

```env
ADMIN_EMAILS=kent.fenwick@gmail.com
ADMIN_MCP_ENABLED=true
ADMIN_MCP_ALLOWED_ORIGINS=
```

Set that value explicitly in production. Generate a new, dedicated admin key while authenticated as `kent.fenwick@gmail.com`; do not add `admin` to a key shared with another integration.

```json
POST /api_keys
{
  "api_key": {
    "name": "Admin MCP",
    "scopes": ["admin"]
  }
}
```

Save the returned `ng_...` value immediately because it cannot be retrieved again.

Rotate the key at least every 30 days: create a replacement, update and test the MCP client, then revoke the old key with `DELETE /api_keys/:id`. The admin MCP can be disabled immediately by setting `ADMIN_MCP_ENABLED=false` and rolling the API service.

## Connecting

Configure an MCP client with the API deployment URL and a bearer header:

```text
URL: https://api.listygifty.com/admin/mcp
Authorization: Bearer ng_your_admin_key
Content-Type: application/json
```

For local development, use `http://localhost:3001/admin/mcp`.

## Tools

The server exposes:

- `admin_get_stats` and `admin_list_resource_types`;
- generic paginated `admin_list_records`, `admin_get_record`, `admin_create_record`, `admin_update_record`, and `admin_delete_record` tools over an explicit domain allowlist;
- audited `admin_reveal_wishlist_claims` and `admin_reveal_exchange_matches` tools that require a reason;
- `admin_preview_email` followed by `admin_confirm_email` for plain-text email to a registered user; and
- `admin_preview_user_deletion` followed by `admin_confirm_user_deletion` for destructive account removal.

The marketing suite adds:

- `admin_analytics_overview`, `admin_analytics_acquisition`, and `admin_analytics_pages` for traffic, campaign, conversion, cost, and landing-page analysis;
- `admin_analytics_funnel`, `admin_analytics_event_breakdown`, and `admin_analytics_retention` for behavioral and cohort analysis;
- `admin_analytics_event_catalog` to discover the available marketing and product event vocabulary;
- `admin_analytics_events` and reason-gated `admin_analytics_user_journey` for bounded diagnosis; and
- `admin_upsert_marketing_spend` and `admin_list_marketing_spend` for CAC, CPA, CPC, and ROAS-ready campaign inputs.

Agentic planning is built around persistent metric goals:

- `admin_list_metric_definitions` discovers goal-ready growth, conversion, product-event, funnel, and spend metrics;
- `admin_analytics_timeseries` returns daily, weekly, or monthly evidence;
- `admin_create_metric_goal`, `admin_list_metric_goals`, `admin_update_metric_goal`, and `admin_delete_metric_goal` manage the complete goal lifecycle; and
- `admin_evaluate_metric_goals` returns current value, target progress, elapsed pace, on-track/risk state, trend series, and a suggested next analytical action.

For example, create a `signups` goal for user growth, a `visitor_to_signup_rate` goal for conversion, an `event_count` goal filtered to `mobile_gift_idea_captured`, or a `funnel_conversion_rate` goal with ordered event steps. Goal windows are limited to 366 days and funnel goal series use weekly or monthly buckets.

See [First-party analytics](first-party-analytics.md) for metric definitions and example questions.

Use `admin_list_resource_types` before generic CRUD to discover supported resources and mutable fields. Collections are limited to 100 records per page and use `after_id` cursors.

## Privacy and confirmations

Bulk record lists omit email fields. Explicit single-record lookup can return email, but all normal responses remove token, secret, key, and digest fields. Wishlist claimant identities and exchange matches are available only through their dedicated audited tools.

Email and user-deletion confirmation tokens expire after 15 minutes and work once. Email bodies are not copied into audit metadata. The active administrator and every allowlisted administrator are protected from deletion. If a target user's data changes after deletion preview, confirmation is rejected and a new preview is required.

Every read, mutation, sensitive reveal, preview, and confirmation writes an `AdminAuditEvent` with safe metadata and the request ID.

## Hardened HTTP boundary

The endpoint accepts at most 256 KiB per request, 20 JSON-RPC calls per batch, and 32 levels of JSON nesting. It centrally validates tool arguments against the same schemas advertised by `tools/list`, ignores notification-shaped tool calls without executing them, applies per-IP and per-credential throttles, and returns no-store security headers. Browser requests with an `Origin` header are denied unless that exact origin is configured in `ADMIN_MCP_ALLOWED_ORIGINS`; normal hosted MCP clients make server-to-server requests without this header.

Email and user-deletion confirmations are bound to the exact API key that created the preview. A replacement or secondary key cannot confirm an older key's pending action.
