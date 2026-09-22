# Mobile gift exchange UX audit

September 22, 2026

The core experience now works through creation, invitation, joining, wishlists, drawing names, and viewing a match. The biggest problems were at the handoffs. A valid password could leave someone stuck at sign-in. A failed join could hide the invitation. An empty wishlist gave the giver nowhere to go. Those paths now have a clear next step.

The rehearsal used the real mobile app in Expo Go on an iPhone 17 Pro Max simulator, the local Rails API, PostgreSQL, and the development Clerk instance. Mimestream provided the account identities and actual sign-in verification emails. Exchange emails went to the local Mailpit inbox. This was a development rehearsal, not a production release or an inbox-deliverability test.

Five identities participated: Runner, Agora, Giga, Kent, and Marie. The three business identities without development accounts were provisioned through Clerk. Existing development identities were reused where available. Kent used a Gmail alias because the original Gmail address already belonged to a local seed user with a different authentication identity. Existing credentials and that seed user's ownership were left intact.

The organizer and one invitee completed the main journey through the native UI. Three additional participants joined and added ideas through authenticated API sessions to exercise matching and privacy across five accounts. Those temporary API sessions were revoked after each check. Fresh-account signup was reviewed and regression-tested, but was not completed end to end through the native signup form.

| Step | What happened in the rehearsal | Result |
| --- | --- | --- |
| Create | Runner created **Cozy Autumn Gift Swap UX Rehearsal**, set October 18 and a $25–$50 budget, and included themselves. | Created through the native UI. |
| Invite | Runner invited Agora and Giga by email. The exchange also had a shared join link. | Personal invitations and shared-link joining worked. |
| Authenticate | Runner signed in with a password plus an emailed verification code. Agora used an emailed sign-in code while opening a personal invitation. | Actual codes were read in Mimestream. The app returned Agora to the same invitation after sign-in. |
| Join | Agora accepted the personal invitation through the native UI. Giga, Kent, and Marie joined through the shared-link API. | Five distinct participants joined without taking over another person's slot. |
| Add ideas | Runner added socks. Agora added a puzzle and coffee using both save actions. Kent and Marie added ideas through the API. | Each participant's ideas remained attached to their own wishlist. Giga was deliberately left empty. |
| Draw | Runner drew names through the native UI. | The confirmation explained that five people would receive matches, joining would close, and one person still needed ideas. |
| Reveal | Runner opened **Unwrap My Match**. | The native screen showed Giga, the exchange date, budget, and the empty wishlist. |
| Ask for ideas | Runner tapped **Ask for gift ideas**. | One anonymous email reached Giga. The screen confirmed it was sent. A repeated request received the server's cooldown error. |
| Add an idea later | Giga added a reading blanket through the API. | Only Runner received the update email. Returning to the native match screen showed the blanket, description, and $40 price. |
| Recover a decline | A separate two-person rehearsal began with Giga declining. Runner tapped **Invite again** in the native UI. | The invitation reopened, Giga accepted through the API, and Runner drew names successfully. The screen scrolled to the match action after drawing. |

The five-person draw produced Runner → Giga, Agora → Runner, Giga → Agora, Kent → Marie, and Marie → Kent. Every participant had one unique recipient, nobody drew themselves, and five assignment emails arrived. Every account could read its own and its recipient's wishlist. Requests for unrelated wishlists returned 403, including requests by the organizer. Participant rosters did not expose other people's assignments. Non-organizer rosters also omitted private email addresses and invitation tokens.

| Priority | Friction or bug | Change | Evidence |
| --- | --- | --- | --- |
| High | Password sign-in silently stopped when Clerk required another verification step. | Added email verification and authenticator-code handling, resend, back navigation, and an explicit error for unsupported steps. | Observed and fixed during native sign-in; regression tests cover the intermediate states. |
| High | A passwordless account had no email-code option on the login screen. | Added **Email me a sign-in code**. | Completed on the native invitation journey with a real email code. |
| High | A failed join replaced the invitation with an error screen. | Kept the invitation visible with a retryable action error. | Controller regression test fails the request, retries, and verifies navigation to the exchange. |
| High | Someone already in the exchange could try to consume another person's personal invitation. | Added an API guard and a **Use a different account** action that preserves the invitation destination. | API regression test verifies the second invitation stays unclaimed. |
| High | Resending a declined invitation emailed a link that still could not be accepted. | Added **Invite again** for organizers and reset a declined invitation to invited when resent. The server rechecks exchange state under a lock. | Native resend plus actual API acceptance; Rails regression test. |
| High | Cached exchange data could hide another person's join or the organizer's draw for 30–60 seconds, even when revisiting the screen. | Exchange screens now fetch current server state on focus and refresh. | Observed in the recovery rehearsal; regression test seeds stale summaries and verifies fresh joins and matches. |
| Medium | Signup omitted name fields required by the configured Clerk instance. | Added first and last name fields, trimmed inputs, verification resend, and an edit-details path. | Controller tests. Fresh signup still needs a native end-to-end check. |
| Medium | Readiness did not clearly explain who would receive a match. | Show actual joined counts, wishlist progress, and the names/count of pending invitees excluded from a draw. Confirm that joining closes. | Five-person native draw and model tests. |
| Medium | The email invitation action was buried. Used invitations still offered copy/share actions. | Put **Invite by email** beside link sharing, show explicit participant status, and show invitation links only for pending participants. | Native organizer walkthrough and component tests. |
| Medium | An empty match wishlist ended with “check back later.” | Added anonymous **Ask for gift ideas**, loading/sent states, and readable server errors. | Native request, email inspection, cooldown check, and private update email after a new idea. |
| Medium | The match action was below the organizer's own wishlist, and drawing could leave it above the scroll position. | Moved **Unwrap My Match** first and scroll to the top after drawing. Completed exchanges retain access to their match. | Native post-draw walkthrough; completed-state model regression. |
| Medium | Save & Add Another cleared the form without clear confirmation. | Show the saved item's name and give success feedback before the next item. | Two consecutive ideas added through the native UI. |
| Medium | Impossible dates and partially numeric amounts could pass local validation. | Validate real calendar dates and complete numeric amounts; reject negative budgets and malformed invitation emails. | Input and exchange-model tests. |
| Low | Several action labels had weak contrast in dark mode, and invitation controls were small. | Improved action text colours, made invitation controls at least 44 points high, and improved keyboard handling on forms. | Native visual inspection in dark mode. |

The development server also crashed on file changes because Expo's CLI expected the older Metro watcher event format. A versioned patch now adapts the newer events. The simulator stayed connected while the fixes were edited and rebuilt. This patch is development tooling, not a change to the exchange product flow.

Validation completed:

- Mobile: **241 tests across 36 suites passed**, plus TypeScript checks.
- Exchange API: **52 tests, 585 assertions passed**, covering invitations, matching, exclusions, privacy, lifecycle, and notifications.
- Shared services: **6 transport tests passed**. The service package rebuilt successfully.
- The root production build passed during the rehearsal. The final additional changes were checked with the mobile suite, mobile typecheck, service rebuild/tests, focused Rails tests, and RuboCop on the three touched API files.
- `git diff --check` passed.

There are still a few release checks and product improvements to make concrete. The current Apple universal-link configuration covers personal invitations and shared join links. Match and wishlist-update emails use web destinations, so they do not yet provide a verified direct return to those native screens. Test production links from Mail on a physical iPhone with the release build installed, including the signed-out path. Android, native Apple/Google login, push notification delivery, large accessibility text, and fresh-account native signup were not exercised in this rehearsal.

A native date picker would remove the need to type YYYY-MM-DD. A short “You're in. Add a couple of ideas while everyone joins” message would make the waiting period friendlier. A fresh match notification while the exchange screen remains open would also help; the current fixes update on return or refresh and do not add live subscriptions.

The local rehearsal data remains available as exchanges **32** and **33**. The web preview is at `http://localhost:3002`, the API at `http://localhost:3001`, and captured exchange emails at `http://localhost:8025`. Local-only configuration and temporary credentials were not added to the repository. Changes remain uncommitted and undeployed. Pre-existing workspace changes were preserved.
