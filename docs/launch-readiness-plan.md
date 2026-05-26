# Listy Gifty Launch Readiness Plan

This plan turns `GOALS.md` into the next operating checklist for product, engineering, and go-to-market work.

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
   - Add optional link, price, recipient, giver, and status after the idea is saved.
   - Track time-to-save in analytics once event tracking is wired.

2. Household readiness
   - Seed templates for Christmas, birthdays, teachers, and in-laws.
   - Make sharing a list obvious from list detail.
   - Keep invite links revocable and visible to owners.

3. Gift exchange readiness
   - Mobile users can create an exchange with name, date, and budget range.
   - Owners can add participants, send invites, verify accepted count, and draw matches.
   - Participants can accept invites, add wishlist items, and view their match after the draw.
   - Before launch, test one complete exchange with at least four participants and one exclusion.

4. App Store readiness
   - Maintain TestFlight default group: `Internal Testers`.
   - Keep app review data current and production-safe.
   - Capture screenshots that show lists, people, exchanges, and profile settings.

5. Activation metric
   - A household is activated when it has at least one list, three people, and five gifts.
   - Secondary activation: at least one shared collaborator or one gift exchange participant.

## Business GTM Checklist

Initial ICP:
- HR leaders and office managers at remote or hybrid companies with 25-250 employees.
- Founder-led teams that already send onboarding gifts, holiday boxes, or client gifts.

First three offers:
- Remote-team holiday box coordination.
- New-hire onboarding gift kits.
- Work anniversary and milestone gifting calendar.

Discovery script:
- How do you track gift recipients today?
- Who owns addresses, allergies, budget approvals, and shipping status?
- How many people are involved in the workflow?
- What breaks every year?
- What would make this worth paying for before the next gifting season?

Business success metric:
- A company is activated when it imports or creates 20 people, creates one business workspace, and tracks 20 gifts or one exchange.

## Next Engineering Bets

1. Quick capture persistence
   - Save the minimum idea first, then encourage adding details.
   - Consider a default "Ideas" status and default active list.

2. Exchange completion
   - Make invite, wishlist, draw, and match visibility testable end to end on mobile.
   - Add owner-facing readiness states that explain why an exchange cannot be drawn yet.
   - Add copy/share controls for participant invite links for cases where email delivery fails.

3. Calendar and reminders
   - Surface upcoming birthdays and gift deadlines before purchase windows close.
   - Start with in-app reminders before native calendar sync.

4. Purchase loop
   - Normalize links and merchant metadata.
   - Track purchase status before attempting direct checkout.

## Messaging

Homepage promise:
> Capture gift ideas when they happen, organize every recipient and occasion, and run gift exchanges without a group thread plus a spreadsheet.

Consumer CTA:
> Start your 2026 gift plan now.

Business CTA:
> Run employee gifting without the spreadsheet.

Do not lead with AI. AI is a helpful assistant layer after the core gift-planning loop works.
