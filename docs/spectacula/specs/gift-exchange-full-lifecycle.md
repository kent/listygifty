# Gift Exchange Full Lifecycle

Status: Done v1
Purpose: Five-user publish, exclusion, notification, anonymous nudge, privacy, and MCP lifecycle.

## 1. Problem Statement

The exchange product supports invitations, acceptance, exclusions, matching, and
private wishlists, but the lifecycle is incomplete. “Start” does not communicate
the irreversible publish boundary, assignment email reveals a match before login,
wishlist changes have no notification, and there is no anonymous way for a giver
to request more ideas. The remote Rails MCP and npm MCP adapter must expose the
same lifecycle without weakening the secrecy rules.

## 2. Goals and Non-Goals

### 2.1 Goals

- Exercise a realistic five-account Clerk flow locally from creation through publish.
- Support two organizer-defined, symmetric exclusion rules before publish.
- Email participants that matches are ready without disclosing names in email.
- Notify only the assigned giver when their recipient adds a wishlist item.
- Let only an assigned giver anonymously nudge their recipient, with a cooldown.
- Expose equivalent lifecycle operations and role/capability data through MCP.
- Prove privacy and authorization with API, mailer, MCP, and browser tests.

### 2.2 Non-Goals

- Re-running or editing matches after publish.
- Real-time push/WebSocket delivery; v1 uses durable in-app records and email.
- Organizer access to assignments, participant emails outside organizer views, or
  sender identity in nudge notifications.
- Mobile UI parity in this increment; shared API types and services remain usable.

## 3. System Overview

Actors are organizer/owner, accepted participant, giver (an accepted participant
after publish), and recipient/match. “Giver” and “recipient” are contextual
capabilities, not global roles. The organizer may also be a participant.

The Rails API is the authority for matching, authorization, durable exchange
notifications, anonymous nudge cooldowns, and mail dispatch. Next.js renders
organizer and participant workflows. Both MCP transports call the same API
authorization boundaries. Local Docker adds a queue worker and Mailpit so
background mail is exercised in the same shape as production.

## 4. Core Requirements

- An organizer can create an exchange, invite four people, see pending/joined
  states, add exactly the desired exclusion rules, and publish after at least
  three people have accepted.
- Publishing matches accepted participants only, closes outstanding invitations,
  records `published_at`, and is irreversible.
- Every accepted participant receives a login-to-reveal email. Match names and
  other assignments must not appear in that email or organizer responses.
- A participant can view only their own assignment and their recipient’s wishlist.
- Adding a wishlist item after publish creates one notification for each assigned
  giver and queues an email to that giver. Unrelated users receive nothing.
- A giver can nudge only their own recipient. The recipient sees an anonymous
  notification/email; the sender is not serialized. Repeat nudges are blocked for
  24 hours.
- Organizer-only actions (invite, exclusion, publish) and participant-only actions
  (own wishlist, own match, nudge) are enforced in HTTP and MCP handlers.
- Non-organizer MCP roster output never includes email, invite token, or assignments.

## 5. Proposed Design

Add `published_at` to exchanges and introduce `ExchangeNotification` with
`recipient_participant`, `kind`, optional `wishlist_item`, `read_at`, and timestamps.
Notifications intentionally omit an actor field so anonymous nudges cannot leak
their sender through serialization or future admin tooling.

`GiftExchange#publishable?` requires inviting status and at least three accepted
participants. Publishing marks outstanding invites declined, validates matching
against exclusions, assigns accepted participants, changes status to active, and
sets `published_at` in one transaction.

Routes:

- `POST /gift_exchanges/:id/publish` (`/start` remains a compatibility alias)
- `GET /gift_exchanges/:id/exchange_notifications`
- `PATCH /gift_exchanges/:id/exchange_notifications/:id/read`
- `POST /gift_exchanges/:id/nudge_match`

MCP adds `publish_gift_exchange`, `accept_exchange_invite`,
`decline_exchange_invite`, `nudge_exchange_match`,
`list_exchange_notifications`, and `mark_exchange_notification_read`.
`start_gift_exchange` remains as a compatibility alias.
Exchange responses expose composable `roles` (`owner`, `organizer`,
`participant`, `matcher`) plus explicit capabilities, so an organizer who also
participates does not lose either side of their permissions.

## 6. Failure Modes and Safeguards

- Impossible exclusions: matching aborts atomically and the exchange remains inviting.
- Pending invite after publish: accept/decline returns a lifecycle error.
- Nudge against arbitrary participant: the server derives the target from the
  caller’s assignment; no target ID is accepted.
- Nudge spam: a database-backed 24-hour cooldown returns 422 with the next allowed time.
- Queue/mail outage: the durable notification remains visible; jobs retry through
  Solid Queue and local Mailpit makes delivery inspectable.
- Concurrent publish: row lock plus status check permits only one transition.

## 7. Test and Validation Plan

- Rails model/controller/mailer/MCP tests, full Rails suite, RuboCop.
- Web lint/typecheck/build and Playwright against five real Clerk development users.
- Playwright covers create, four invites/acceptances, two exclusions, publish,
  private match reveal, wishlist update notification, anonymous nudge, and denial
  for an unrelated user.
- Mailpit assertions cover four invitation emails, five reveal emails, a wishlist
  update email, and an anonymous nudge email with no leaked sender/match.
- MCP tests run calls as organizer and multiple participants and assert capability
  boundaries and redacted output.

## 8. Implementation Checklist

- [x] Add publish state, durable notifications, anonymous nudge, and mailers.
- [x] Add API routes/controllers/serialization with role capabilities.
- [x] Add web publish, notification, and nudge interactions.
- [x] Add equivalent Rails MCP and npm MCP adapter tools.
- [x] Add queue worker and Mailpit to the reusable local bootstrap.
- [x] Expand five-user API and browser E2E coverage.
- [x] Run format, lint, typecheck, build, Rails, MCP, and Playwright gates.
- [x] Self-review privacy and role boundaries against this spec.

## 9. Open Questions / Assumptions

- “Enough” means at least three accepted participants. Publishing deliberately
  closes outstanding invitations; the confirmation UI names that consequence.
- A nudge is fixed copy with no user-entered message, preventing harassment and
  accidental identity disclosure.
- Wishlist-update notifications are created only after publish; pre-publish edits
  do not reveal future assignment relationships.
