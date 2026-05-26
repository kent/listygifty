# Business Gifting GTM Plan

This plan turns the first business workflows into a repeatable sales motion for remote-team holiday boxes, new-hire kits, and milestone gifting.

## ICP

Primary buyers:
- People ops, HR, office managers, founder assistants, and founders at remote or hybrid companies.
- Team size: 25-250 employees.
- Existing behavior: employee gifting is managed in spreadsheets, chat threads, forms, and vendor portals.

Best triggers:
- Holiday gifting planning starts.
- New-hire kit ownership moves between recruiting, HR, and managers.
- Work anniversaries, birthdays, promotions, or parental leave gifts are missed.
- A vendor asks for a final shipping list and no one trusts the spreadsheet.

## Positioning

Primary message:
> Run employee gifting without a spreadsheet, missed address, or mystery shipping status.

Supporting proof points:
- Import people and optional shipping addresses from CSV.
- Bulk-create gifts from CSV and match recipients by name or email.
- Default recipient addresses apply to new gifts for fulfillment.
- Export people and gifts with fulfillment-ready address fields.
- Use reports to find missing recipients, costs, links, and shipping addresses.

What not to lead with:
- AI recommendations.
- Marketplace inventory.
- Charity or donation gifting.

## Offer Ladder

1. Remote-team holiday box
   - Pain: the annual shipping spreadsheet is hard to collect, audit, and hand off.
   - Demo data: 25 employees, 25 gifts, 5 missing addresses, 3 missing links.
   - CTA: set up one list and import the first recipient CSV.

2. New-hire onboarding kit
   - Pain: ownership breaks between offer acceptance and first-day delivery.
   - Demo data: 8 new hires, standard kit gift, status by recipient.
   - CTA: import a current new-hire cohort and create the standard kit gift.

3. Work anniversaries and milestones
   - Pain: meaningful moments are missed because reminders live in notes or calendars.
   - Demo data: 20 employees with birthdays and notes for milestones.
   - CTA: add the current quarter's milestone list and assign owners.

## Qualification

Discovery questions:
- How do you track gift recipients, addresses, and preferences today?
- Who updates statuses after purchase, shipping, and delivery?
- How often do people discover missing addresses or links after handoff?
- How many employees or recipients are in the next gifting workflow?
- What would make this worth paying for before the next gifting season?

Good-fit signals:
- 20+ recipients in a recurring workflow.
- More than one person touches the process.
- Shipping addresses are collected manually.
- A final export goes to an assistant, vendor, or fulfillment partner.
- The buyer has already missed a deadline or had a bad address handoff.

Bad-fit signals:
- One-time gift under 10 recipients.
- Vendor already owns the entire recipient and fulfillment workflow.
- Buyer wants curated inventory before workflow tracking.

## Demo Path

Use one business workspace and keep the demo operational:
1. Show dashboard activation progress for the business workspace.
2. Open the holiday box gift list.
3. Import a people CSV with default shipping addresses.
4. Import a gift CSV that matches recipients by name or email.
5. Open reports, then show fulfillment and exceptions.
6. Export gift CSV and explain the handoff.
7. Schedule birthday or list reminders to show the calendar thread.

Demo success:
- The buyer sees the current spreadsheet replaced by people, gifts, statuses, addresses, exceptions, and export.
- The buyer can name the first workflow they would import.
- The business dashboard shows the selected signup workflow beside the activation checklist.
- App review seed data now includes a BrightWorks holiday-box workspace with 20 recipients, 20 gifts, milestone dates, default shipping addresses, and one missing-address fulfillment exception for this walkthrough.

## Follow-Up Template

Subject: Employee gifting without the handoff spreadsheet

Hi {{first_name}},

Based on what you described, the immediate Listy Gifty fit is {{workflow}}:
- import recipients and shipping addresses,
- bulk-create gifts for the list,
- track purchase and delivery status,
- export a cleaner fulfillment handoff,
- catch missing costs, links, recipients, or addresses before the deadline.

The best next step is a 20-minute setup session using one real CSV from the next gifting workflow.

## Activation Targets

Business activation:
- One business workspace created.
- 20 people imported or created.
- 20 gifts tracked, or one exchange/workflow started.
- At least one report/export used before handoff.

Measurement:
- `business_signup_started`
- `business_workspace_created`
- `teams_plan_started`
- `people_csv_import_completed`
- `people_csv_exported`
- `gift_csv_import_completed`
- `gift_csv_exported`
- `gift_bulk_status_updated`
- `fulfillment_report_viewed`

## Next GTM Bets

- Export and fulfillment report tracking are now in place; use them to find workspaces that reached handoff.
- People CSV export is now available from the People page and tracked for recipient handoff.
- Visible gift bulk status updates are now available and tracked for handoff progress.
- Billing now presents a Teams pilot card that routes buyers into business workspace setup.
- Business signup and import dialogs now include instrumented sample CSV downloads, with business signup downloads tagged by selected use case, tailored to the selected playbook, and using seeded gift statuses.
- The app review seed now includes a short business demo dataset that mirrors the remote-team holiday box workflow.
- Business dashboards now surface the selected signup use case and tailor activation targets by workflow: holiday boxes, new-hire kits, or milestones.
