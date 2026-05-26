# Listy Gifty Launch Readiness Plan

This plan turns `GOALS.md` into the next operating checklist for product, engineering, and go-to-market work.

Activation measurement details live in `docs/activation-event-dictionary.md`.

## North Star

Help a household capture a real gift idea in under five seconds, then make it easy to turn that idea into a purchased gift before the deadline.

Primary 2026 launch proof:
- 100 households actively planning Christmas gifts by November 2026.
- 5 companies using Listy Gifty for an employee gifting workflow.
- One gift exchange can be created, joined, matched, and completed without a spreadsheet.

## Wedge

The first memorable job is not AI recommendations. It is reliable gift logistics:
- People: who needs a gift.
- Lists: what occasion or deadline the gift belongs to.
- Ideas: fast capture in store, in a browser, or in conversation.
- Status: idea, planned, purchased, wrapped, delivered.
- Exchange: invite, wishlist, draw, match, and remind.

## Consumer Launch Checklist

1. Mobile capture
   - Open app, tap capture, type gift name, save to the default active list.
   - Optional link, price, recipient, and giver fields now sit below the first save action.
   - Mobile gift capture now tracks time-to-save in the gift idea capture analytics event.

2. Household readiness
   - Search for a recipient and create that person directly from the no-match state.
   - Mobile new-list templates now cover Christmas, birthdays, teachers, and in-laws.
   - Make sharing a list obvious from list detail.
   - Keep invite links revocable and visible to owners.

3. Gift exchange readiness
   - Mobile users can create an exchange with name, date, and budget range.
   - Owners can add participants, send invites, add exclusion rules, verify accepted count, and draw matches.
   - Participants can accept invites, add wishlist items before the draw, and view their match after the draw.
   - Before launch, complete the rehearsal in `docs/testflight-exchange-rehearsal.md`.

4. App Store readiness
   - Maintain TestFlight default group: `Internal Testers`.
   - App review seed data now includes lists, people, gifts, and an active exchange with wishlists, matches, and an exclusion.
   - Capture screenshots that show lists, people, exchanges, and profile settings.

5. Activation metric
   - A household is activated when it has at least one list, three people, and five gifts.
   - Secondary activation: at least one shared collaborator or one gift exchange participant.
- Track the funnel as list created -> people added -> gift ideas captured -> gift status changed.
- Mobile now emits activation events for list creation, person creation, gift capture, gift status changes, exchange creation, participant invites, wishlist additions, exclusions, and match draw.
- Web dashboard now shows household activation progress against the first-list, three-people, five-gifts, and collaboration/exchange milestones.

## Business GTM Checklist

Initial ICP:
- HR leaders and office managers at remote or hybrid companies with 25-250 employees.
- Founder-led teams that already send onboarding gifts, holiday boxes, or client gifts.

First three offers:
- Remote-team holiday box coordination.
- New-hire onboarding gift kits.
- Work anniversary and milestone gifting calendar.

Reusable detail lives in `docs/business-gifting-playbooks.md`.
Outbound, demo, and qualification detail lives in `docs/business-gifting-gtm-plan.md`.
The homepage and business signup now route buyers into those three playbooks directly.

Discovery script:
- How do you track gift recipients today?
- Who owns addresses, allergies, budget approvals, and shipping status?
- How many people are involved in the workflow?
- What breaks every year?
- What would make this worth paying for before the next gifting season?

Business success metric:
- A company is activated when it imports or creates 20 people, creates one business workspace, and tracks 20 gifts or one exchange.
- Web now tracks `business_signup_started` and `business_workspace_created` with the selected playbook use case, so the homepage-to-workspace funnel is measurable.
- Web people CSV import now tracks start, completion, address-created counts, skipped rows, and failed attempts.
- Web gift CSV import now tracks start, completion, created-gift count, created-person count, and failed attempts.
- People CSV import now accepts optional business shipping-address columns and reports created/skipped address counts.
- Imported business addresses can now become each recipient's default shipping address and apply automatically to new gifts.
- People CSV export now includes default shipping-address columns for round-trip fulfillment ops.
- Gift CSV import now bulk-creates gifts for a list and can create/match recipients by name or email.
- Gift list reports now include fulfillment exceptions for missing recipients, costs, links, and shipping addresses.
- Gift list reports now include a fulfillment handoff view with recipient rows, address readiness, exception counts, and a CSV export action.
- Web dashboard now shows business activation progress against the workspace, 20-people, 20-gifts, and first-workflow milestones.

## Next Engineering Bets

1. Quick capture persistence
   - Save the minimum idea first, then encourage adding details.
   - Mobile quick capture now remembers the last selected list and falls back to the highest-priority active list.
   - Consider a default "Ideas" status when custom statuses are empty or confusing.

2. Exchange completion
   - Make invite, wishlist, draw, and match visibility testable end to end on mobile.
   - Add owner-facing readiness states that explain why an exchange cannot be drawn yet.
   - Add copy/share controls for participant invite links for cases where email delivery fails.
   - Test mobile exclusion management with one four-person family exchange before promising Secret Santa parity.

3. Calendar and reminders
   - Surface upcoming birthdays and gift deadlines before purchase windows close.
   - Mobile list cards now show overdue, due today, due tomorrow, and due-within-30-days reminders.
   - Mobile people now support recipient birthdays and show upcoming birthday reminders.
   - Mobile people now support recipient milestone labels and dates, with upcoming milestone reminders.
   - Web people cards and detail pages now display and edit birthdays.
   - Web people cards and detail pages now display and edit milestone labels and dates.
   - Mobile list detail now schedules native local notifications for dated gift lists.
   - Mobile people can now schedule native yearly birthday reminders.
   - Next reminder step: external calendar sync.

4. Purchase loop
   - Mobile now normalizes gift links and surfaces merchant/domain labels on gift cards.
   - Mobile gift cards now support swipe-to-advance status from the list detail view.

## Messaging

Homepage promise:
> Capture gift ideas when they happen, organize every recipient and occasion, and run gift exchanges without a group thread plus a spreadsheet.

Consumer CTA:
> Start your 2026 gift plan now.

Business CTA:
> Run employee gifting without the spreadsheet.

Do not lead with AI. AI is a helpful assistant layer after the core gift-planning loop works.

## Recent Progress Notes

- Mobile exchange participants can now build their wishlist during the inviting phase, before matches are drawn.
- Mobile exchange owners can now add and remove exclusion rules before drawing matches.
- Mobile list cards now surface date-based deadline reminders, and date-only formatting is normalized to local calendar days.
- Mobile people now support birthday entry and upcoming birthday reminders.
- Web people now support birthday display and editing.
- Mobile gift list detail can schedule native local reminder notifications for dated lists.
- Mobile people can schedule recurring local birthday reminders.
- Mobile list creation now offers Christmas, birthdays, teachers, and in-laws templates; undated lists no longer get forced to today.
- Mobile gift links now normalize missing URL schemes and show merchant/domain labels on gift cards.
- Mobile list-detail gift cards now support quick status advancement and reuse the status-change analytics event.
- Mobile quick gift capture now exposes save actions before optional details.
- Mobile quick gift capture now tracks time-to-save for the core capture event.
- Mobile quick gift capture now remembers the last selected list for repeat idea entry.
- Mobile now tracks core activation, gift status-change, and exchange-funnel events through PostHog when analytics is configured.
- Web homepage and business signup now present the first three business gifting playbooks as concrete entry points.
- Web business signup now tracks playbook-specific start and workspace-created events.
- Business people import now supports optional shipping-address columns for fulfillment setup.
- New gift recipients inherit their default shipping address, reducing manual fulfillment setup after import.
- App review seed data now covers gift exchange screens in addition to lists, people, and gifts.
- Mobile dependency audit was refreshed; remaining mobile npm audit items require a breaking Expo 56 SDK upgrade.
- Gift CSV exports now include recipient emails and shipping addresses for fulfillment handoff.
- People CSV exports now include each person's default shipping address fields.
- Web gift lists now support CSV gift import for bulk business setup.
- Web gift CSV import now emits funnel events for business activation measurement.
- Web people CSV import now emits funnel events for business activation measurement.
- Web gift reports now surface fulfillment exceptions for business handoff.
- Web and MCP dependencies were refreshed to reduce actionable high-severity advisories; the remaining root npm audit item is Next's exact nested PostCSS dependency, where npm currently suggests a breaking downgrade rather than a safe patch.
