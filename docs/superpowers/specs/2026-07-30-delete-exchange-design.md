# Delete Gift Exchanges — Design

Date: 2026-07-30
Status: approved (decisions delegated by Kent)

## Goal

Organizers can delete a gift exchange from the web app, with a warning when
the exchange is in the `inviting` or `active` stage. Participants of
inviting/active exchanges are emailed that the exchange was cancelled. The
same behavior applies to the existing `delete_gift_exchange` MCP tool.

## Current state

- `DELETE /gift_exchanges/:id` already exists (owner-only, hard delete,
  `dependent: :destroy` cascades participants/exclusions/notifications).
- `giftExchangesService.delete()` already exists in the web service layer.
- MCP tool `delete_gift_exchange` already calls `destroy!` directly.
- There is no delete UI anywhere in the web app, and no cancellation email.

## Decisions

- **Scope**: every status is deletable (draft, inviting, active, completed).
- **Warning UX**: a single confirm dialog. For `inviting`/`active` the dialog
  lists consequences (participants lose access, matches are destroyed,
  pending invite links stop working) and requires a red destructive button.
  Draft/completed get a plain "This can't be undone" confirmation.
- **Placement**: exchange detail page only, visible to the organizer.
- **Notification**: participants of `inviting`/`active` exchanges (all
  statuses except `declined`, excluding the deleting organizer's own
  participant row) receive a cancellation email at their `delivery_email`.
  Draft and completed deletions send no email.
- **Hard delete** stays; no soft-delete/undo (YAGNI, pre-PMF).

## Architecture

### Backend (Rails API)

1. **`ExchangeDeletionService`** (`app/services/exchange_deletion_service.rb`)
   - `.delete!(exchange)` — collects cancellation recipients when status is
     `inviting`/`active`, destroys the exchange, then enqueues mailer jobs
     with **plain string args** (exchange is gone by delivery time, so no
     GlobalID record references).
2. **`ExchangeMailer#cancellation`** — args: recipient email, participant
   name, exchange name, organizer name. HTML + text templates matching the
   existing mailer voice.
3. **`GiftExchangesController#destroy`** — delegates to the service.
4. **MCP `delete_gift_exchange`** — delegates to the same service; tool
   description updated to mention cancellation emails.
5. **`GiftExchange#capabilities_for`** — add `delete: owner?(check_user)` so
   clients gate the UI on capabilities, matching the `redo` pattern.

### Web (Next.js)

- Exchange detail page (`apps/web/src/app/exchanges/[id]/page.tsx`):
  a "Delete exchange" action shown when `capabilities.delete`, placed with
  the other organizer controls, styled as destructive. Clicking opens a
  confirm dialog (same inline-panel pattern as "Redo exchange") with
  status-aware copy; confirming calls `giftExchangesService.delete()` and
  routes to `/exchanges`.
- `GiftExchangeCapabilities` type in `packages/types` gains `delete: boolean`.

## Error handling

- API: existing `require_owner` (403) and not-found (404) paths unchanged.
- Web: failed delete shows the page's existing error surface; button
  disabled while in flight.
- Mailer enqueue happens after successful destroy inside the service; a
  mailer failure never blocks deletion (jobs retry independently).

## Testing

- Integration tests (`gift_exchanges_api_test.rb`): destroy on an
  inviting/active exchange enqueues cancellation mail to non-declined,
  non-organizer participants; draft/completed enqueue none; non-owner 403.
- MCP test: `delete_gift_exchange` enqueues the same mail.
