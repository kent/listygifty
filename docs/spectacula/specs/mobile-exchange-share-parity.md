# Mobile Exchange Share Parity

Status: Done v1
Purpose: Bring the Expo app into parity with canonical exchange share links, preview-before-join behavior, and the current shared exchange contracts.

## 1. Overview and Goals

The production API and web app now generate canonical organizer share links at
`/e/:slug/:share_token`, render a public exchange preview, require an explicit
authenticated join, and send organizer/joiner confirmation mail. The mobile app
still understands only private participant invitation links. It also no longer
typechecks against the current shared exchange type/service contract introduced
by the recent slug and capability work.

This increment performs a full mobile compatibility pass: restore a clean build,
let organizers share the exchange-level URL, open that URL as an app/universal
link, preserve it through authentication, preview before mutation, and join via
the same Rails endpoint as web.

## 2. Scope and Non-Goals

### 2.1 Goals

- Restore mobile type safety against current `@niftygifty/types` and services.
- Expose share/copy actions for owner-visible `GiftExchange.share_url` while the
  roster is open.
- Register `/e/:slug/:share_token` for iOS universal links and Android app links.
- Add an Expo route that safely renders public join details without authentication.
- Preserve the share or private-invite route across sign-in, sign-up, email
  verification, Google SSO, and Apple authentication.
- Require an explicit Join action after authentication; never join on link open.
- Invalidate exchange caches after joining and navigate to the joined exchange.
- Keep old private participant invitation behavior working.
- Add focused tests for URL/auth-return validation and updated exchange models.

### 2.2 Non-Goals

- Rendering Open Graph metadata in the native app; web remains the unfurl target.
- Duplicating Rails email logic in mobile.
- Shortening or exposing the share token.
- Adding a new native notification type for joins.
- Redesigning unrelated mobile exchange creation, matching, or wishlist flows.

## 3. Audit Findings and Current State

1. `apps/mobile/app.json` registers Android links only for `/join/exchange`; the
   Apple association document also permits only that route.
2. No `app/e/[slug]/[shareToken]` route or exchange-level public join service
   exists in mobile.
3. The root auth router treats only `join` as a public deep-link group.
4. Private invite sign-in buttons navigate to auth without a return path, so the
   app sends a newly authenticated user to Lists instead of back to the invite.
5. The exchange detail UI shares per-person invite tokens but does not expose the
   organizer's new group share URL.
6. Mobile calls a removed `GiftExchangesService#getById`; the shared service now
   exposes the slug-compatible `getBySlug` API.
7. Screenshot fixtures and tests omit newly required `GiftExchange` fields and
   therefore mask or trigger contract drift.

## 4. UX and Interaction Model

An organizer viewing a draft/inviting exchange sees an “Invite with a link” card
with Share and Copy actions. The API-provided URL is the source of truth.

Opening `https://listygifty.com/e/family-secret-santa/<token>` on an installed
device opens the native preview. The preview shows exchange name, organizer,
date, budget, accepted count, and closed state. Signed-out users choose Sign In
or Create Account; the app carries a validated app-local return path. Once auth
finishes, the same preview reappears. A signed-in user may enter an optional
display name and tap Join Exchange. Success navigates to the exchange detail.

The same return mechanism applies to legacy private participant invitations.

## 5. Functional and Security Requirements

1. The share token remains the only join authority; slug is descriptive.
2. Mobile fetches preview data from `GET /exchange_join/:share_token` and joins
   through `POST /exchange_join/:share_token/join` in the shared service layer.
3. Only `/e/<single-segment-slug>/<single-segment-token>` and
   `/join/exchange/<single-segment-token>` may be used as post-auth return paths.
   External URLs, protocol-relative paths, traversal, query injection, fragments,
   arrays with conflicting values, and unrelated internal routes fall back to
   the normal Lists landing page.
4. Opening a link or completing auth never mutates membership automatically.
5. Wrong slugs canonicalize in-app using the API-returned slug.
6. Closed exchanges show context and the server-provided reason but no join action.
7. Organizer group sharing is available only to owners with a non-empty share URL
   while status is `draft` or `inviting`.
8. Share and join failures remain recoverable and produce user-visible feedback.
9. Successful join clears relevant bootstrap/exchange caches before navigation.
10. Universal/app links cover production and staging domains without broadening
    unrelated URL handling.

## 6. Proposed Design

- Add `createExchangeJoinsService` to `packages/services` with public detail and
  authenticated join methods.
- Wrap it in mobile `lib/api.ts` so successful joins invalidate exchange caches.
- Add `useExchangeShareJoinController` to own preview loading, slug correction,
  auth routing, explicit join, analytics, and action errors.
- Add `app/e/[slug]/[shareToken].tsx` for native presentation.
- Add an allowlist-based `normalizeAuthReturnPath` helper used by the root auth
  router and auth-screen cross-links.
- Update the existing exchange detail controller/screen with group share and copy
  actions using the API's `share_url`.
- Use `getBySlug(String(id))` behind the mobile compatibility wrapper so existing
  numeric in-app routes remain valid while the shared service contract stays
  canonical.
- Update app-link entitlements/config and current mobile fixtures.

## 7. Compatibility and Failure Handling

- Existing numeric exchange screen routes remain supported by the Rails
  slug-or-ID lookup.
- Existing private invite links remain registered and gain reliable auth return.
- A missing/invalid token renders a retryable invalid-link state.
- Network failure does not join and leaves the preview retryable.
- Join failure leaves the preview visible and re-enables the button.
- Invalid return destinations are discarded rather than passed to Expo Router.
- Screenshot mode receives deterministic mocks for the new service.

## 8. Validation Matrix

| Area | Acceptance check |
|---|---|
| Shared services | Types/services build and expose get-details/join |
| Type contract | Mobile typecheck passes with current `GiftExchange` fields |
| Auth safety | Unit tests accept only the two supported return patterns |
| Existing models | Exchange helper tests include slug/capability/share fields |
| Mobile unit suite | Jest passes independently from monorepo workspaces |
| Expo config | iOS AASA and Android intent filters include `/e/*` |
| Navigation | Signed-out preview returns after login/signup; explicit join remains required |
| Organizer UX | Open owned exchange can share/copy `share_url`; closed/non-owner cannot |
| Backward compatibility | Private invite route and numeric detail routes remain valid |
| Self-review | Implementation matches this spec and the parent share/join contract |

## 9. Definition of Done

- [x] Mobile typecheck and complete Jest suite pass.
- [x] Shared packages and root build pass.
- [x] Canonical `/e` app route, entitlements, preview, auth return, and join exist.
- [x] Organizer can share/copy the canonical group URL.
- [x] Current mobile fixtures match shared exchange types.
- [x] Private invitation auth return is repaired.
- [x] Final review against this spec passes.

## 10. Assumptions

- The API-provided `share_url` is canonical and should never be reconstructed in
  mobile organizer UI.
- Numeric internal exchange routes may remain until a separate navigation cleanup;
  Rails intentionally supports both IDs and slugs.
- Plain Spectacula review policy applies; separate final vetting is off.
