# Exchange Share Link — Design

Date: 2026-07-31
Status: approved by Kent ("Build it! Add to MCP too")

## Goal

An organizer drops one link into a group chat; anyone with the link signs
in and joins the exchange themselves. No per-person email entry required.

## Decisions (confirmed with Kent)

- **Join flow**: sign in / create account, then instant join as an accepted
  participant. No organizer approval step.
- **Link lifetime**: valid while the exchange is `draft` or `inviting`;
  dead once published. Redo → reopen revives the same link. No manual
  toggle or regenerate.
- **Names**: join form shows an editable name field prefilled from the
  account; email always comes from the signed-in user.
- **MCP**: organizers see `share_url` on their exchanges through both MCP
  servers.

## Data

`gift_exchanges.share_token` — string, `null: false`, unique index.
Generated via `has_secure_token :share_token` on create; migration
backfills existing rows.

## API

- `GET /exchange_join/:share_token` (public):
  `{ exchange: { name, slug, exchange_date, budget_min, budget_max,
  owner_name, accepted_count }, join_open: bool, closed_reason: string|null }`
- `POST /exchange_join/:share_token/join` (authenticated), body
  `{ name?: string }`, inside `with_lock`:
  - Exchange published/completed → 422 "already drawn names".
  - Current user is already an accepted participant (or the organizer with
    a participant row) → 200, idempotent, returns the exchange.
  - A participant row exists with the user's email (pre-invited or
    previously declined) → accept it, update name if provided, link user.
  - Otherwise create a participant: user's email, provided/prefilled name,
    `status: accepted`, linked user.
  - Returns `{ message, exchange }` (exchange rendered for current_user).
- `GiftExchangeBlueprint`: new `share_url` field
  (`FRONTEND_URL + /join/x/ + share_token`), rendered only for the owner.

## MCP

- Rails `mcp_controller`: owner-serialized exchanges include `share_url`;
  `get_gift_exchange`/`create_gift_exchange` descriptions mention the
  shareable join link.
- TS `packages/mcp-server`: proxies the REST API, so `share_url` flows
  through; tool descriptions updated to mention it. `GiftExchange` type
  gains `share_url?: string | null`.

## Web

- New public page `/join/x/[shareToken]`: exchange summary card; if
  join_open, an editable prefilled name field + Join button (unauth users
  are routed through sign-in and return); on success routes to the
  exchange. Closed links show the closed_reason.
- Exchange detail page: organizer sees a "Copy join link" button (while
  draft/inviting) in the Participants card header; copies `share_url` to
  the clipboard with a toast.
- New `exchangeJoinsService` in `apps/web/src/services`.

## Testing

Integration tests (`exchange_joins_api_test.rb`): public show for
open/closed exchanges; join creates accepted participant; join twice is
idempotent; join with matching pre-invited email accepts that row; join
after decline re-accepts; join on published exchange 422s; unauthenticated
join 401s. Blueprint test: share_url only for owner.
