# Admin MCP Security Hardening Specification

> **Historical note:** This completed specification records the original API-key-only launch. The admin MCP now also supports first-party OAuth 2.1 with exact admin resource/scope binding; see [`docs/admin-mcp.md`](../../admin-mcp.md). Dedicated API keys remain a break-glass fallback.


Status: Approved for implementation under the user's delegated security judgment
Purpose: Harden the global Listy Gifty admin MCP, constrain and validate its HTTP/JSON-RPC boundary, strengthen administrator key lifecycle, and safely issue a dedicated credential.
Audience: Listy Gifty engineering and the sole administrator, `kent.fenwick@gmail.com`.

## 1. Problem Statement

`POST /admin/mcp` is a high-impact control plane: it can read global customer data, reveal purpose-gated private data, modify domain records, queue administrator email, and confirm user deletion. Its existing design already requires an admin-scoped API key owned by an allowlisted email, redacts normal output, audits tools, and uses expiring confirmation tokens. The remaining boundary is permissive in several ways: admin keys may be created without expiry, the endpoint accepts two credential header styles, request and batch sizes are not explicitly bounded, advertised tool schemas are not enforced centrally, browser origins are not denied by default, notification-shaped tool calls can execute without a response, and audit events do not consistently identify the exact credential.

The endpoint must be safe enough to connect to an agentic MCP client without turning malformed traffic, a leaked secondary key, browser-origin abuse, or oversized tool arguments into an avoidable incident. Credential delivery must also distinguish a local key from a production-valid key and never commit or log raw credentials.

## 2. Goals and Non-Goals

### 2.1 Goals

- Retain the separate stateless Streamable HTTP JSON-RPC endpoint and the sole-admin email allowlist.
- Require `Authorization: Bearer ng_...` for admin MCP; reject `X-API-Key`, OAuth, Clerk, malformed bearer values, revoked keys, and expired keys.
- Make admin keys dedicated, exactly `admin` scoped, automatically expiring within 30 days, and mintable through the API only by an allowlisted administrator.
- Add an environment-controlled admin MCP kill switch and explicitly configure the production allowlist.
- Bound content type, declared and actual body size, JSON nesting, batch length, method length, JSON-RPC IDs, params shape, and tool arguments.
- Enforce every advertised tool input schema before invoking a handler, including required/unknown properties, scalar types, enums, length/range limits, array bounds, and nested objects.
- Execute only `notifications/initialized` as a notification; never execute a notification-shaped `tools/call` or other request that lacks an ID.
- Deny browser `Origin` requests unless explicitly allowlisted, while allowing normal server-side MCP clients that omit `Origin`.
- Return no-store and defensive response headers and keep raw secrets/email bodies out of application logs.
- Add endpoint-specific per-IP and per-key rate controls without storing or emitting raw keys.
- Bind email/deletion confirmations and all tool audit metadata to the exact API key used for preview/call.
- Generate one dedicated credential, show its raw bearer token once in the user-facing handoff, and state its exact environment, expiry, endpoint, and revocation path.

### 2.2 Non-Goals

- Changing ordinary `/mcp`, general API-key header compatibility, Clerk authentication, or the admin tool business capabilities.
- Adding OAuth to the admin endpoint, IP allowlisting that would break hosted MCP clients, mTLS, a VPN, or an API gateway product.
- Committing a raw credential, putting it in Pulumi state, Secret Manager, application logs, tests, documentation, or shell history.
- Silently deploying to production merely to make a locally generated key appear production-valid. Production deployment/key insertion must be explicit and accurately reported.

## 3. Security Invariants

1. Authorization succeeds only when the endpoint is enabled, the bearer key is structurally valid, the key record is active, its scope is exactly `admin`, and its owner is allowlisted at request time.
2. The sole default and production-configured allowlisted identity is `kent.fenwick@gmail.com`.
3. A request cannot reach tool code until HTTP, JSON-RPC, and tool-schema validation pass.
4. Mutation-like notifications never execute silently.
5. Confirmation is bound to actor, action, target/snapshot, expiry, single-use state, and exact API key.
6. All successful authentication and tool activity is attributable to a request ID, actor, and API key ID without recording the raw key.
7. A disabled endpoint fails closed; an origin not explicitly allowed fails closed.
8. No analytics or admin hardening work is allowed to degrade ordinary user-facing request paths.

## 4. HTTP and JSON-RPC Boundary

The endpoint accepts only `POST` routed by Rails and requires `application/json`. It reads at most 256 KiB plus one sentinel byte and returns HTTP 413 for declared or actual excess. JSON parsing uses a maximum nesting depth of 32. A batch must contain 1-20 requests. A single request must be an object with JSON-RPC `2.0`, a method of at most 100 characters, object params, and an absent/null/string/integer ID; booleans, objects, arrays, and non-integral IDs are invalid IDs.

Only `notifications/initialized` may omit an ID and execute. Other notification-shaped messages are ignored without side effects, as required for JSON-RPC notifications. Normal calls receive JSON-RPC responses. Validation/domain errors retain tool `isError` responses where appropriate; unexpected failures log request ID and exception class only.

Successful and error responses set `Cache-Control: no-store, private`, `Pragma: no-cache`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: no-referrer`. Requests with an `Origin` header are rejected unless the normalized origin is listed in `ADMIN_MCP_ALLOWED_ORIGINS`; the default list is empty.

## 5. Tool Schema Enforcement

A small internal validator consumes the same schema objects returned by `tools/list`. It supports the schema features used by the registry: object properties/required/additionalProperties, arrays/items/minItems/maxItems, string minLength/maxLength, integer and number bounds, boolean/null, and enum. It recursively validates with a maximum depth and emits bounded path-based errors. Unknown tool arguments fail when `additionalProperties` is false.

The validator runs inside `ToolRegistry#call` before the handler. Existing model/service validation remains authoritative for domain rules; schema validation protects the generic boundary and makes the advertised MCP contract executable rather than descriptive.

## 6. Credential Lifecycle and Authorization

`ApiKey.generate_for` normalizes scopes. If `admin` is requested, it must be the only scope and expiry defaults to 30 days; an expiry later than 30 days is invalid. Admin MCP authentication accepts exactly one syntactically valid bearer key. Key lookup validates the fixed key shape before hashing and rate-limits `last_used_at` writes to once every five minutes.

`ApiKeysController#create` rejects an admin scope unless `Admin::Authorization.allowed?(current_user)`. The admin MCP endpoint has an `ADMIN_MCP_ENABLED` kill switch, defaulting on locally and explicitly set in production. Pulumi sets `ADMIN_EMAILS=kent.fenwick@gmail.com` and `ADMIN_MCP_ENABLED=true`; allowed origins remain empty unless a browser-based client is intentionally introduced.

Rack Attack adds a bounded admin-MCP IP throttle and a per-credential discriminator derived with SHA-256 from the presented token. The digest is used only as an in-memory/cache discriminator and is never logged or returned. Existing global throttling remains in force.

## 7. Confirmation and Audit Binding

The admin controller passes the authenticated `ApiKey` to `ToolRegistry`. Every registry audit merges `api_key_id` and `request_id`. Email drafts persist the preview key ID; action-confirmation payloads persist it. Confirmation rejects a request made with a different key even when it belongs to the same administrator. Email/deletion service audits include the credential ID but continue excluding raw confirmation tokens and email bodies.

Parameter filtering explicitly covers message bodies in addition to existing token/key/email patterns. Generic unexpected-error logs exclude exception messages because those messages can echo user-controlled values.

## 8. Failure Modes and Recovery

- Kill switch off: return 404 so the control plane is not advertised.
- Missing/malformed/expired/revoked key: HTTP 401 with a Bearer challenge.
- Valid non-admin or non-allowlisted key: HTTP 403 and a safe credential-bound audit when an actor is known.
- Disallowed origin or content type: HTTP 403/415 before JSON parsing or tools.
- Oversized request: HTTP 413 without parsing the full body.
- Invalid schema/protocol: bounded JSON-RPC/tool errors, no handler side effect.
- Rate exceeded: HTTP 429 with `Retry-After` through existing Rack Attack behavior.
- Lost/leaked credential: revoke by API key ID or Rails console, mint a replacement, and update the client; existing confirmations created by the revoked key cannot be completed with the replacement.
- Production is not deployed: issue only a local key and clearly label it; do not present it as a hosted credential.

## 9. Validation Matrix

- Authentication: Bearer-only; malformed length/characters; missing/revoked/expired; non-admin; non-allowlisted; exact admin scope; 30-day expiry; kill switch.
- HTTP: media type, content-length and actual-size limits, response headers, origin omitted/allowed/rejected.
- JSON-RPC: depth, empty/oversized batches, invalid IDs, non-object params, unknown method, notification no-side-effect behavior.
- Schema validator: nested required/unknown fields, enum/type/range/length/array checks, valid definitions for every registered tool.
- Confirmation: same actor with different admin key cannot confirm email or deletion; original key can; expiry/single-use behavior remains.
- Audit/logging: API key ID and request ID recorded; no raw bearer/confirmation/email body; unexpected logs omit user message.
- Regression: all admin, analytics, ordinary MCP, API-key, Rails, lint, autoload, and Brakeman checks pass.
- HTTP smoke: local stack health, unauthenticated 401, authenticated initialize/ping/tools list, and one read-only stats call with the issued local key.

## 10. Definition of Done

- [x] Admin MCP is bearer-only, kill-switchable, origin-aware, size-bounded, batch-bounded, and defensively headed.
- [x] JSON-RPC messages and every tool argument object are centrally validated before execution.
- [x] Admin keys are dedicated, allowlisted-owner-only, and expire within 30 days.
- [x] Admin rate controls and reduced key-touch write amplification are implemented.
- [x] Tool audits and destructive/email confirmations bind to the exact credential.
- [x] Logs and filtered parameters do not expose bodies or secrets.
- [x] Focused and full security/regression verification passes.
- [x] One dedicated bearer credential is issued and its environment, expiry, endpoint, and revocation details are accurately handed to the user.
- [x] Final implementation review matches this specification.

## 11. Assumptions

- The user wants a directly usable credential but has not explicitly requested a production deployment in this turn. The implementation may mint and smoke-test a local credential; a production-valid credential requires the hardened code to be deployed and a key row inserted into the production database.
- Hosted MCP clients make server-to-server requests without a browser `Origin` header.
- Thirty-day rotation is an appropriate default for a control-plane bearer credential; the user can request a shorter lifetime.
- The existing Cloud Run/Cloud SQL and TLS boundary remains the hosting platform when deployment is later authorized.
