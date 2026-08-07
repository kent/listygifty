# Listy Gifty Admin MCP Server Specification

> **Historical note:** This completed specification records the original API-key-only launch. The admin MCP now also supports first-party OAuth 2.1 with exact admin resource/scope binding; see [`docs/admin-mcp.md`](../../admin-mcp.md). Dedicated API keys remain a break-glass fallback.


Status: Approved for implementation
Purpose: Define a production-capable, HTTP-based MCP control plane for inspecting and administering all Listy Gifty customer data, with guarded email and user-deletion workflows.
Audience: Listy Gifty engineering and the sole product administrator.

## 1. Problem Statement

Listy Gifty has an HTTP MCP endpoint at `/mcp`, but it is intentionally scoped to the authenticated user's workspaces and data. It cannot answer product-wide questions, inspect another user's account, repair cross-user data, or send an administrator-authored message. Reusing that endpoint for global administration would weaken its authorization assumptions and could expose private gift, wishlist, exchange, or authentication data to ordinary MCP clients.

The product needs a separate admin MCP endpoint that provides global statistics and controlled CRUD access to product-domain records. It must also support free-form email to registered users. Because this surface can expose private claims and Secret Santa matches or delete an entire account, its authentication, auditing, redaction, and confirmation behavior are part of the feature rather than optional hardening.

## 2. Goals and Non-Goals

### 2.1 Goals

- Provide a Streamable HTTP JSON-RPC MCP endpoint at `/admin/mcp`.
- Allow only an active API key with the `admin` scope whose owner email is in the normalized `ADMIN_EMAILS` allowlist. The default and initial sole administrator is `kent.fenwick@gmail.com`.
- Provide product-wide totals, status breakdowns, and daily activity for a caller-selected period.
- Provide paginated, filterable CRUD over an explicit allowlist of user-facing domain resources, including users, gift lists, gifts, people, wishlists, gift exchanges, participants, and their supporting records.
- Redact secrets in every normal response. Return email addresses only on explicit record lookup, not bulk list output.
- Reveal private wishlist claims and exchange matches only through explicitly named tools that require a reason and create an audit event.
- Send plain-text administrator-authored email only to a registered Listy Gifty user through a preview-and-confirm workflow.
- Require preview and confirmation before deleting a user and all account-owned data. Prevent deletion of the active or allowlisted administrator.
- Audit authentication-relevant, read-sensitive, mutation, email, and deletion activity without recording API keys, private tokens, or full email bodies.

### 2.2 Non-Goals

- OAuth access to the admin endpoint.
- Arbitrary SQL, arbitrary Active Record class access, or CRUD over authentication internals (`api_keys`, OAuth clients/tokens/codes), Rails job tables, Active Storage internals, or admin audit records.
- Sending mail to an address that does not belong to a registered user.
- Accepting administrator-authored raw HTML. V1 email bodies are plain text rendered safely by Rails templates.
- A graphical admin dashboard or changes to web/mobile clients.
- Production deployment in this implementation run.

## 3. Actors and Security Boundary

### 3.1 Sole administrator

The initial administrator identity is `kent.fenwick@gmail.com`. Authorization requires both:

1. An active `ng_` API key containing the `admin` scope.
2. A key owner whose normalized email is present in `ADMIN_EMAILS`.

`ADMIN_EMAILS` is a comma-separated environment setting and defaults to the sole initial administrator. Changing a user's database email, possessing a normal read/write key, or authenticating through OAuth must not grant admin access. Failed authorization returns HTTP 401 for a missing/invalid key and HTTP 403 for a valid key that fails admin scope or email checks.

### 3.2 Separate control plane

`/admin/mcp` has a separate controller and tool registry. Existing `/mcp` behavior and its user-scoped authorization remain unchanged. Admin helpers must not be callable through the ordinary registry.

## 4. MCP Protocol Contract

The endpoint supports `initialize`, `notifications/initialized`, `ping`, `tools/list`, and `tools/call` for MCP protocol versions already supported by the product (`2025-06-18`, `2025-03-26`, and `2024-11-05`). It accepts single JSON-RPC requests and batches. Tools return one JSON text content block. Expected validation and domain errors return `isError: true` tool results; malformed protocol requests return JSON-RPC errors. Unexpected exceptions are logged server-side and return a generic internal error.

The server identifies itself as `listygifty-admin-mcp`. Resources are omitted in v1 because all global reads require parameters, pagination, or explicit audit context.

## 5. Tool Surface

### 5.1 Statistics and discovery

| Tool | Contract |
|---|---|
| `admin_get_stats` | Accepts `period_days` (default 30, range 1-365). Returns current totals, user/subscription breakdowns, workspace/list/exchange counts, email outcomes, and zero-filled daily creation series. |
| `admin_list_resource_types` | Returns every supported resource, mutable attributes, filter attributes, and whether normal output contains redacted fields. |

### 5.2 Generic domain CRUD

| Tool | Contract |
|---|---|
| `admin_list_records` | Requires a resource name; accepts exact-match filters, `limit` (default 50, max 100), and `after_id`. Returns records ordered by ascending ID plus `next_after_id`. Email fields are redacted in bulk results. |
| `admin_get_record` | Requires resource and numeric ID. Returns one record. Email fields may be shown because this is an explicit lookup. Secrets and sensitive match/claim fields remain redacted. |
| `admin_create_record` | Requires resource and an attributes object. Only catalogued mutable fields are accepted. Returns the created record. Creating a user also creates a personal workspace and owner membership atomically. |
| `admin_update_record` | Requires resource, ID, and attributes. Only catalogued mutable fields are accepted. Returns the updated record. |
| `admin_delete_record` | Deletes a non-user resource. User deletion is rejected and redirected to the confirmation workflow. Returns the deleted type and ID. |

Supported v1 resources are: `users`, `workspaces`, `workspace_memberships`, `company_profiles`, `addresses`, `workspace_invites`, `holidays`, `holiday_users`, `holiday_people`, `people`, `gift_suggestions`, `gift_statuses`, `gifts`, `gift_changes`, `gift_recipients`, `gift_givers`, `wishlists`, `wishlist_items`, `wishlist_item_claims`, `gift_exchanges`, `exchange_participants`, `exchange_exclusions`, `exchange_wishlist_items`, `exchange_notifications`, `match_arrangements`, `match_slots`, `notification_preferences`, and `email_deliveries`.

Records are created and updated through their Rails models so validations and callbacks remain authoritative. Unknown attributes, immutable attributes, unsupported resources, invalid filters, and records that do not exist produce tool errors. All mutations are audited with changed attribute names, never raw secret values.

### 5.3 Sensitive inspection

| Tool | Contract |
|---|---|
| `admin_reveal_wishlist_claims` | Requires `wishlist_id` and a non-empty `reason`. Returns item, claimant identity, quantities, and purchase/reveal state. It never returns claim tokens. |
| `admin_reveal_exchange_matches` | Requires `exchange_id` and a non-empty `reason`. Returns each giver and matched recipient identity. It never returns invite or share tokens. |

Normal CRUD output always redacts token/key/secret/digest fields. It additionally redacts `matched_participant_id` and claimant identity fields so the explicit tools are the only supported reveal path.

### 5.4 Administrator email

`admin_preview_email` accepts `user_id`, `subject`, and plain-text `body`. Subject is 1-200 characters and body is 1-20,000 characters. The service stores a pending draft with a hashed one-time confirmation token and a 15-minute expiry, then returns the recipient, subject, body preview, expiry, and raw token.

`admin_confirm_email` accepts that token. It locks and consumes the draft, queues `AdminMailer#custom_message`, and returns the draft ID and queued status. A token is single-use; expired, unknown, or already-consumed tokens fail safely. Only the user email resolved during preview is used at send time. Preview and confirmation are both audited; the audit metadata includes recipient user/email and subject but not the body.

### 5.5 User deletion

`admin_preview_user_deletion` accepts a target `user_id`. It rejects the caller and any user whose normalized email is allowlisted. It computes an impact snapshot covering owned/created resources, memberships, collaborations, claims, keys/tokens, and workspaces. It stores a hashed, one-time, 15-minute confirmation associated with the target and snapshot and returns the raw token plus impact.

`admin_confirm_user_deletion` accepts the token, locks the confirmation, revalidates the target and administrator protections, consumes the token, and deletes the user inside a transaction. The deletion service removes workspaces created by the target (and therefore their scoped data) before destroying the remaining user record and its dependent records. The final audit event records the target ID/email and previewed impact. It must not record private tokens. A failed transaction leaves the user and confirmation usable until expiry.

## 6. Data Model

### 6.1 `admin_audit_events`

| Field | Purpose |
|---|---|
| `actor_id` | Required administrator user foreign key with delete restriction. |
| `action` | Stable action such as `record.update`, `sensitive.matches.reveal`, or `email.confirm`. |
| `resource_type`, `resource_id` | Optional affected record identity. |
| `metadata` | JSON object containing safe context, changed field names, reason, counts, and request ID. |
| `created_at` | Immutable event timestamp. |

### 6.2 `admin_email_drafts`

Stores creator, recipient user, recipient email snapshot, subject, plain-text body, confirmation digest, expiry, and `queued_at`. Database indexes enforce confirmation digest uniqueness and support pending-draft cleanup.

### 6.3 `admin_action_confirmations`

Stores actor, action (`delete_user`), target type/ID, target label, JSON payload/impact snapshot, confirmation digest, expiry, and `consumed_at`. Confirmation tokens are generated with cryptographic randomness and only their SHA-256 digests are persisted.

## 7. Failure Modes and Safeguards

- Revoked/expired keys, normal keys, OAuth tokens, and keys owned by non-allowlisted users cannot initialize or call the server.
- Pagination is mandatory for collections; limits above 100 are rejected/coerced to the maximum and unbounded queries are not exposed.
- The catalog is an allowlist. Model names and attribute names are never constantized directly from caller input.
- Token, secret, key, digest, and private share/invite/claim fields are removed recursively from normal output.
- Bulk reads redact all email fields. Explicit single-record reads may include email, while matches and claims still require dedicated tools.
- Email is limited to registered users, plain text, bounded size, one-time confirmation, and background delivery through the existing Postmark configuration.
- User deletion is impossible without a recent preview, impossible for the caller/allowlisted administrator, transactional, and audited.
- Race conditions are handled with row locks on email drafts and action confirmations.
- Audit failures are fail-closed for mutations, email confirmation, deletion, and sensitive reads: the protected action does not proceed without its audit record.

## 8. Operations and Privacy

Production must set `ADMIN_EMAILS=kent.fenwick@gmail.com` explicitly even though the application default matches it. The raw admin key is shown only once by the existing API-key creation flow and must be stored as a secret. Logs may include request IDs and exception classes but must not log Authorization headers, confirmation tokens, email bodies, invite/share tokens, matches, or claim identities.

Operators can inspect `admin_audit_events` directly for incident response. No retention deletion is added in v1. Pending drafts/confirmations expire logically; a later maintenance job may purge old rows.

## 9. Test and Validation Matrix

| Area | Required checks |
|---|---|
| Authentication | Missing/invalid key is 401; read/write key is 403; admin key for wrong email is 403; active admin key for Kent succeeds; OAuth is rejected. |
| MCP | Initialize, list tools, call tool, batch behavior, parse errors, unknown methods/tools. |
| Stats | Totals and status maps match fixtures; date range is bounded; daily series includes empty days. |
| CRUD | Every catalog entry exposes valid metadata; filtering/pagination works; valid create/update/delete uses model validation; unknown resource/attribute/filter fails. |
| Privacy | Bulk email redaction; explicit lookup email visibility; secret redaction; ordinary participant/claim reads do not reveal matches or claimant identity. |
| Sensitive tools | Reason required; expected data returned without tokens; successful calls create audit events. |
| Email | Preview validation, registered-user restriction, digest storage, expiry, single use, queued mail, safe template rendering, and audit metadata excluding body. |
| User deletion | Impact preview, admin/self protection, expiry/single use, cascade behavior, rollback on failure, and audit event. |
| Regression | Existing `/mcp` controller tests remain green. Rails test suite and RuboCop for touched files pass. |

## 10. Rollout

1. Apply migrations for audit, email draft, and confirmation tables.
2. Set `ADMIN_EMAILS` explicitly in the production secret/configuration layer.
3. Generate a new admin-scoped API key owned by `kent.fenwick@gmail.com`; do not upgrade a shared key.
4. Connect the MCP client to `https://<api-host>/admin/mcp` with that bearer key.
5. Verify `ping`, `admin_get_stats`, redaction, email preview without confirmation, then a controlled email send.
6. Review the audit trail before using mutation or deletion tools.

Deployment and key generation are not part of this local implementation run.

## 11. Definition of Done

- [x] Separate HTTP admin MCP route, authentication, protocol handler, and documented connection example exist.
- [x] Stats and resource discovery tools exist.
- [x] Catalogued domain resources support paginated reads and allowlisted create/update/delete behavior.
- [x] Sensitive claim and exchange-match tools require reasons and audit successful use.
- [x] Email preview/confirm is registered-user-only, one-time, expiring, queued, safely rendered, and audited.
- [x] User deletion preview/confirm protects the sole admin, reports impact, cascades data transactionally, and is audited.
- [x] No ordinary response exposes API/OAuth credentials or private tokens.
- [x] Migrations, models, services, controller tests, mailer tests, and documentation are complete.
- [x] Relevant verification passes and the implementation is reviewed against this spec.

## 12. Resolved Decisions and Assumptions

- The user selected HTTP transport and a separate admin API key rather than OAuth.
- Full CRUD means the explicit user-facing domain catalog in section 5.2, not authentication, job, storage, or audit internals.
- Email is free-form plain text, limited to existing users, and requires preview plus confirmation.
- User deletion requires preview plus confirmation; ordinary non-user deletes are immediate but audited.
- Email addresses appear only after explicit record lookup. Wishlist claims and exchange matches require purpose-specific audited tools.
- `kent.fenwick@gmail.com` is the only initial administrator.
- The implementation is built and tested locally but not deployed.
