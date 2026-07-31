# Gift Exchange Share and Join Experience

Status: Done v1
Purpose: Define canonical share URLs, rich social previews, authenticated self-serve joining, and join email notifications.

## 1. Overview and Goals

Gift exchange organizers can already copy a token-backed public link, and the
public API exposes enough information to describe the exchange. The production
web link is token-only and client-rendered, however, so it is hard to recognize
in a message and social crawlers receive only Listy Gifty's generic metadata.
The join endpoint also does not notify either the organizer or the person who
joined.

This increment makes a shared link self-explanatory before it is opened, gives
the recipient a trustworthy preview before authentication, returns them to the
same exchange after sign-in or sign-up, and confirms a successful first join to
both parties.

## 2. Scope and Non-Goals

### 2.1 Goals

- Generate new share URLs as `/e/:slug/:share_token`.
- Preserve existing `/join/x/:share_token` links and API token contracts.
- Render exchange-specific Open Graph and Twitter metadata on the server.
- Render a 1200 by 630 exchange-specific social image without storing new media.
- Show organizer, exchange name, date, budget, roster count, and open/closed state
  on an intermediate page before any membership mutation.
- Require an explicit Join button from an authenticated person.
- Return unauthenticated people to the canonical preview after Clerk sign-in or
  sign-up, where they can explicitly join.
- Email the organizer and joiner after a first transition into accepted status.
- Keep repeat join requests idempotent and free of duplicate email.

### 2.2 Non-Goals

- Removing or rotating existing share tokens.
- Putting participant names, emails, wishlists, or match information in public
  metadata.
- Automatically joining a person merely because authentication completed.
- Adding SMS, push, or in-app notifications in this increment.
- Mobile deep-link parity; the generated web URL remains usable from mobile.

## 3. Current State and Constraints

- Rails owns `GiftExchange#share_url`, the public token lookup, join locking, and
  participant creation/claiming.
- Next.js `/join/x/[shareToken]` fetches all content in a client component, which
  prevents useful crawler metadata.
- The public API response contains the exchange slug and only non-sensitive
  preview fields.
- Clerk's supported return query in this repository is `redirect_url`; the share
  page currently uses `redirect`.
- Joining is idempotent at the data layer, but no join mail exists.
- A share token remains the authorization secret. The slug is descriptive and
  must never be used to locate or authorize an exchange.

## 4. UX and Interaction Model

The organizer copies a URL such as
`https://listygifty.com/e/family-secret-santa/<token>`.
Messaging clients
show an image and text naming the exchange and organizer, along with available
date/budget context.

Opening the link first shows a public invitation card. An unauthenticated user
chooses Sign In or Create Account. Both auth destinations carry an encoded
`redirect_url` pointing back to the canonical invitation page. Authentication
does not join automatically: the returned user reviews the same card, may edit
their display name, and presses Join Exchange.

A successful join displays a confirmation toast and navigates to the exchange.
The organizer receives a concise “person joined” email, and the joiner receives
a confirmation email with a link to the exchange and next-step wishlist copy.

Closed links keep showing safe exchange context and a closed explanation but no
join action. Invalid tokens show generic invalid-link metadata and UI.

## 5. Functional Requirements

1. `GiftExchange#share_url` must include the current slug before the token.
2. The token-only route must resolve the token and permanently redirect to the
   canonical slug route. A supplied stale/wrong slug must also redirect to the
   canonical slug returned by the API.
3. API lookup and join routes remain token-only and unchanged for compatibility.
4. Server metadata must include a canonical URL, exchange-specific title and
   description, `og:type=website`, large Open Graph image, and Twitter large-card
   fields. Join pages must remain `noindex, follow` because their URLs contain a
   bearer-style token.
5. Public text must include only the already approved join-detail fields.
6. The social image must remain useful when date or budget is absent and must not
   disclose the share token in visible text.
7. A join notification pair is queued only when a participant changes from
   missing/invited/declined to accepted. Reposting as an already accepted member
   must not queue mail again.
8. Mail queueing occurs only after the database transaction succeeds.
9. Both HTML and plain-text variants must be provided for each new mail.

## 6. Interfaces and Data Contracts

No schema migration or public API response change is required. The web routing
contract changes as follows:

| Route | Behavior |
|---|---|
| `/e/:slug/:share_token` | Canonical preview, metadata, image, and join UI |
| `/join/x/:share_token` | Compatibility redirect after public token lookup |
| `GET /exchange_join/:share_token` | Existing public preview JSON |
| `POST /exchange_join/:share_token/join` | Existing authenticated mutation plus first-join mail |

The slug is cosmetic. Every read and mutation continues to resolve by the
unguessable share token and Rails remains authoritative for open/closed state.

## 7. Backend Changes

- Change the model-generated URL to include `slug` and `share_token`.
- Track whether the locked join operation represents a first acceptance.
- Add `ExchangeMailer.joined_organizer(participant)` addressed to the exchange
  owner and `ExchangeMailer.join_confirmation(participant)` addressed to the
  participant's delivery email.
- Queue both mailers after the lock/transaction completes only for a first
  acceptance.
- Use canonical exchange URLs in both emails.

## 8. Frontend and Rendering Changes

- Extract the interactive card into a client component that accepts server-loaded
  details rather than requiring a browser-only initial fetch.
- Make the canonical page a server component that loads public details, validates
  the slug, supplies metadata, and passes data into the client component.
- Add a dynamic `opengraph-image` route using `ImageResponse` with the exchange
  name, organizer, date, budget, and roster count.
- Use `redirect_url` with `encodeURIComponent` for both auth buttons.
- Preserve a client refresh path only for the authenticated join mutation.

## 9. Failure Modes, Privacy, and Compatibility

- Invalid/expired tokens return the existing invalid UI and generic noindex
  metadata; the image route returns a branded generic invitation image.
- API unavailability must fail closed and must not expose internal errors in
  metadata.
- Stale slugs canonicalize without weakening token checks.
- Concurrent join submissions remain serialized by `with_lock`; only the request
  observing a non-accepted prior state sends email.
- Mail delivery failure is asynchronous and does not roll back a valid join.
- No recipient list, emails, match state, or token appears in metadata or image
  text.

## 10. Test and Validation Matrix

| Area | Acceptance check |
|---|---|
| Model | Generated share URL contains slug and token |
| Public API | Existing open, closed, and invalid responses still pass |
| Join API | New participant and claimed invite each queue two emails |
| Idempotency | Repeated accepted join queues zero additional emails |
| Mail | Organizer/joiner recipients, subjects, names, and canonical links are correct |
| Web typecheck | Canonical server route, image route, and client component compile |
| Web lint | New routes/components pass repository lint |
| Web build | Next production build recognizes metadata and image routes |
| Self-review | Every requirement above is present and token privacy is preserved |

## 11. Rollout

This is backward-compatible and requires no database migration. Deploy API and
web together so newly copied API URLs resolve immediately. Existing token-only
links continue working through the compatibility route. After deployment, verify
one real exchange URL with an unfurl debugger or messaging client, then perform a
new-account join and confirm both messages in the production mail provider.

## 12. Definition of Done

- [x] New owner-visible share URLs include slug and token.
- [x] Old and stale-slug URLs canonicalize safely.
- [x] Exchange-specific OG/Twitter tags and dynamic image render server-side.
- [x] Preview, auth return, explicit join, confirmation, and navigation work.
- [x] Organizer and joiner receive first-join email; retries do not duplicate it.
- [x] Targeted Rails tests, lint, typecheck, and production web build pass.
- [x] Final self-review against this spec passes.

## 13. Assumptions

- The organizer should be emailed at the current owner account email.
- A person who was invited or declined and later accepts through the shared link
  counts as a join and triggers both messages.
- “After sign in or signup joins them” means returning them to an explicit Join
  button, matching the user's requirement for an intermediate confirmation page
  and avoiding surprise membership mutations.
- Plain `spectacula` policy applies, so separate final vetting is off.
