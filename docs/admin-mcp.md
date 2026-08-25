# Listy Gifty Admin MCP

The admin MCP server is a separate HTTP control plane for product-wide statistics, first-party marketing analytics, support inspection, domain-data CRUD, registered-user email, and guarded user deletion.

## Security model

The endpoint is `https://api.listygifty.com/admin/mcp`. OAuth 2.1 browser authorization is the preferred authentication method. The endpoint advertises its RFC 9728 protected-resource metadata at:

```text
https://api.listygifty.com/.well-known/oauth-protected-resource/admin/mcp
```

An OAuth client must use authorization code + S256 PKCE and request the exact resource `https://api.listygifty.com/admin/mcp` with the sole `admin` scope. Authorization requests are frozen in short-lived, one-time server-side transactions before the browser handoff. The user signs in to the first-party Listy Gifty web application, sees an explicit administrator warning, and approves or denies the connection. Access tokens last one hour. Refresh credentials rotate within a server-locked token family, have a non-sliding one-year maximum lifetime, and revoke the entire family if a rotated credential is replayed.

Admin authorization is checked both when consent is shown and on every MCP request. The authenticated user's normalized email must be in `ADMIN_EMAILS`; the initial and default sole administrator is:

```env
ADMIN_EMAILS=kent.fenwick@gmail.com
ADMIN_MCP_ENABLED=true
ADMIN_MCP_ALLOWED_ORIGINS=
```

The endpoint requires the exact admin audience and scope, rejects ordinary `/mcp` OAuth tokens, rejects tokens from revoked clients, and immediately stops accepting a token if its user is removed from the admin allowlist. The ordinary user-scoped MCP remains a separate connection at `/mcp` with only `read` and `write` scopes.

### Break-glass API keys

Dedicated admin API keys remain supported for recovery and clients that cannot initiate remote OAuth. A key must be active, unexpired, contain only the `admin` scope, belong to an allowlisted user, and be sent through `Authorization: Bearer ...`. `X-API-Key`, Clerk JWTs, and ordinary read/write keys are rejected. Admin keys expire no later than 30 days after creation.

Generate a recovery key from an interactive Clerk browser session authenticated as `kent.fenwick@gmail.com`. Existing API keys and OAuth tokens cannot inspect, mint, rotate, or revoke credentials:

```json
POST /api_keys
{
  "api_key": {
    "name": "Admin MCP break-glass",
    "scopes": ["admin"]
  }
}
```

Save the returned value immediately because it cannot be retrieved again. Store it outside source control, rotate it at least every 30 days, and revoke it when all active clients use OAuth. The admin MCP can be disabled immediately by setting `ADMIN_MCP_ENABLED=false` and rolling the API service.

## Connecting

For an OAuth-capable HTTP MCP client, configure only the server URL:

```text
https://api.listygifty.com/admin/mcp
```

The first unauthenticated request returns a `WWW-Authenticate` challenge containing the resource-metadata URL and `scope="admin"`. The client discovers the Listy Gifty authorization server, opens the browser login/consent page, exchanges the one-time code with PKCE, and refreshes the short-lived credential automatically.

Generic admin clients register dynamically and are deliberately labeled **Unverified client metadata**. Their self-reported name or website is not an identity signal. Before approving, verify the exact callback URI shown on the page and check the explicit “I initiated this connection” confirmation. Pre-registered Claude/ChatGPT consumer clients remain read/write-only; they do not silently gain admin scope.

A non-OAuth client may use the same URL with a dedicated break-glass header:

```text
Authorization: Bearer ng_<redacted-admin-key>
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

The endpoint accepts one JSON-RPC request or notification per POST (top-level arrays/batches are rejected), at most 256 KiB per request, and 32 levels of JSON nesting. It centrally validates tool arguments against the same schemas advertised by `tools/list`, ignores notification-shaped tool calls without executing them, applies per-IP and per-credential throttles, and returns no-store security headers. Browser requests with an `Origin` header are denied unless that exact origin is configured in `ADMIN_MCP_ALLOWED_ORIGINS`; normal hosted MCP clients make server-to-server requests without this header.

Email and user-deletion confirmations are bound to the exact credential that created the preview. A replacement API key, refreshed OAuth access token, or secondary connection cannot confirm an older credential's pending action; preview again after credential rotation.
