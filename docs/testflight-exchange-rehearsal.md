# TestFlight Exchange Rehearsal

This script validates the first public promise for gift exchanges: create an exchange, invite people, collect wishlist items, draw matches, and view a match without using a spreadsheet.

## Default Release Target

- EAS build profile: `production`
- EAS submit profile: `production`
- App Store Connect group: `Internal Testers`
- Internal tester: `kent.fenwick@gmail.com`

Command from `apps/mobile`:

```bash
eas build --platform ios --profile production --auto-submit
```

## Test Accounts

Use four real tester accounts or aliases that can receive invite links.

- Owner: creates and draws the exchange.
- Participant A: accepts invite and adds wishlist item.
- Participant B: accepts invite and adds wishlist item.
- Participant C: accepts invite and adds wishlist item.

## Setup

1. Install the latest TestFlight build from the `Internal Testers` group.
2. Confirm the production API is reachable.
3. Sign in as the owner.
4. Create a gift exchange named `Family Secret Santa Rehearsal`.
5. Set a budget range and an exchange date within the next 30 days.

## Rehearsal Flow

1. Owner invites Participant A, Participant B, and Participant C.
2. Owner shares each participant invite link through the native share sheet.
3. Each participant opens their link on the TestFlight build and accepts.
4. Each participant adds at least one wishlist item before matches are drawn.
5. Owner adds one exclusion rule between two accepted participants.
6. Owner verifies the readiness state allows drawing matches only after all participants are accepted.
7. Owner draws matches.
8. Each participant opens `My Match` and verifies:
   - the matched person is visible;
   - budget and exchange date are visible;
   - wishlist items for the matched person are visible when present;
   - excluded participants were not matched together.

## Exit Criteria

- No participant needs a spreadsheet, group thread, or manual match assignment.
- Invite links work from the native share sheet.
- Wishlist entry works before draw.
- Exclusion rules affect the draw.
- Match reveal works for every participant.
- Analytics events appear for exchange creation, participant invite, wishlist item add, exclusion add, and draw.

## Follow-Ups

- Capture App Store screenshots for lists, people, exchanges, match reveal, and profile settings after a clean rehearsal.
- Repeat the same flow once on a fresh install to catch cache, auth, and deep-link regressions.
- If any tester misses an invite, verify fallback sharing with copied invite links before release.
