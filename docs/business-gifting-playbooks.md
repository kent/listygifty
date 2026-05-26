# Business Gifting Playbooks

These are the first repeatable offers for selling Listy Gifty to teams. Each playbook maps a painful workflow to the product areas that already exist or need focused build-out.

## Playbook 1: Remote-Team Holiday Box

Buyer:
- HR lead, people ops manager, office manager, or founder at a remote/hybrid company.

Trigger:
- The company wants to send a holiday gift to every employee but recipient data, budgets, and shipping status live in spreadsheets and chat threads.

Workflow:
1. Create a business workspace.
2. Add employees as people with email, relationship/category, notes, and shipping metadata when available.
   - People import can set default shipping addresses, and new gifts inherit those addresses for fulfillment.
3. Create a holiday gift list for the current season.
4. Add one or more gift options per employee or cohort.
   - Gift CSV import can bulk-create gifts, match recipients by name or email, and create missing people.
5. Track status from idea to delivered.
6. Export or hand off final shipping/purchase data.
   - Gift CSV exports include recipient emails and shipping addresses when available.
   - People CSV exports include default shipping-address columns for audit and re-import workflows.

Activation:
- 20 employees added.
- One business workspace created.
- 20 gifts tracked with at least one non-idea status.

Sales message:
> Run your remote-team holiday gifting without a spreadsheet, missed address, or mystery shipping status.

## Playbook 2: New-Hire Onboarding Gift Kit

Buyer:
- People ops, recruiting operations, founder assistant, or office manager.

Trigger:
- New hires should receive a welcome gift, but ownership falls between recruiting, HR, and managers.

Workflow:
1. Create an onboarding gift list template.
2. Add each new hire as a person when their start date is confirmed.
3. Add the standard kit as a gift, with optional variants by location or role.
4. Track ordered, shipped, and delivered status.
5. Record notes for future anniversary or milestone gifts.

Activation:
- Five new hires added.
- One reusable onboarding list created.
- At least five gifts moved beyond idea status.

Sales message:
> Make every new hire feel expected before their first day.

## Playbook 3: Work Anniversary and Milestone Gifting

Buyer:
- HR lead or employee experience owner.

Trigger:
- Anniversaries, promotions, parental leave, and major milestones are easy to miss until it is too late.

Workflow:
1. Add employees as people with key dates in notes until calendar fields exist.
2. Create quarterly milestone gift lists.
3. Assign gifts to recipients and owners.
4. Review upcoming milestone lists monthly.
5. Use status and budget fields to keep approvals visible.

Activation:
- 20 employees added.
- One quarterly milestone list created.
- Five milestone gifts tracked.

Sales message:
> Stop missing the moments employees remember.

## Discovery Questions

- Who owns employee gifting today?
- What data is hardest to collect: addresses, sizes, preferences, budget approvals, or shipping status?
- How many people touch the workflow before a gift is delivered?
- What happens when someone declines, moves, or joins late?
- What would make this worth paying for before the next gifting season?

## Funnel Measurement

- Homepage playbook CTAs route into business signup with a `use_case` value for each offer.
- Business signup tracks when a buyer starts the flow and when a workspace is created, including the selected use case.
- The next GTM dashboard should segment workspace starts by remote holiday boxes, onboarding kits, and milestone gifting.

## Product Gaps to Close

- Business import now creates people and optional shipping addresses from one CSV, and imported addresses become recipient defaults for new gifts.
- Calendar/deadline fields for people and lists. People now have birthday dates; business-specific milestone dates are still needed.
- Export view for purchase and fulfillment handoff. Gift and people exports now include fulfillment address data; next step is a dedicated business fulfillment view.
- Bulk gift creation is now available from gift CSV import; bulk status updates are still needed.
- Simple team-level reporting: count, spend, status, and exceptions.
