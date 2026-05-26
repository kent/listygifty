# Activation Event Dictionary

This is the measurement contract for the household and business activation funnels in `GOALS.md`.

## Household Funnel

Activation definition:
- One list created.
- Three people created.
- Five gifts captured.
- Secondary activation: one collaborator or one gift exchange participant.

Events:
- `mobile_list_created`
  - Fires when a mobile list is created.
  - Key properties: `list_id`, `has_date`, `source`, `template_key`.
- `mobile_person_created`
  - Fires when a mobile person is created.
  - Key properties: `person_id`, `has_email`, `has_birthday`, `has_milestone`, `has_relationship`, `source`.
- `mobile_gift_idea_captured`
  - Fires when a mobile gift is created from quick capture or list detail.
  - Key properties: `gift_id`, `list_id`, `status_id`, `source`, `save_mode`, `time_to_save_ms`, `has_recipient`, `has_giver`, `has_link`, `has_cost`.
- `mobile_gift_status_changed`
  - Fires when a gift status changes from mobile.
  - Purchase shortcut source: `gift_detail_purchase_action`.
  - Key properties: `gift_id`, `list_id`, `from_status_id`, `to_status_id`, `source`.
- `mobile_gift_link_opened`
  - Fires when a mobile user opens a saved gift link from a list card or gift detail.
  - Key properties: `gift_id`, `list_id`, `merchant`, `source`.
- `mobile_list_reminder_scheduled`
  - Fires when a mobile user schedules a local notification for a dated list.
  - Key properties: `list_id`, `source`.
- `mobile_birthday_reminder_scheduled`
  - Fires when a mobile user schedules a recurring local birthday notification for a person.
  - Key properties: `person_id`, `source`.
- `mobile_milestone_reminder_scheduled`
  - Fires when a mobile user schedules a recurring local milestone notification for a person.
  - Key properties: `person_id`, `has_label`, `source`.
- `gift_list_calendar_exported`
  - Fires when a web user downloads an `.ics` calendar event for a dated gift list.
  - Key properties: `holiday_id`.
- `person_calendar_exported`
  - Fires when a web user downloads an `.ics` calendar event for a person birthday or milestone.
  - Key properties: `person_id`, `kind`.
- `dashboard_upcoming_date_opened`
  - Fires when a web user opens a list, birthday, or milestone from the dashboard upcoming-dates card.
  - Key properties: `kind`, `days_until`, `source`.

## Exchange Funnel

Activation definition:
- One exchange can be created, invited, wishlisted, drawn, and completed without a spreadsheet.

Events:
- `mobile_exchange_created`
  - Fires when a mobile gift exchange is created.
  - Key properties: `exchange_id`, `has_date`, `has_budget`.
- `mobile_exchange_participant_invited`
  - Fires when an owner adds an exchange participant.
  - Key properties: `exchange_id`, `participant_id`, `has_email`.
- `mobile_exchange_invite_shared`
  - Fires when an owner shares a participant invite through the native share sheet.
  - Key properties: `exchange_id`, `participant_id`, `participant_status`, `source`.
- `mobile_exchange_invite_copied`
  - Fires when an owner copies a participant invite link.
  - Key properties: `exchange_id`, `participant_id`, `participant_status`, `source`.
- `mobile_exchange_wishlist_item_added`
  - Fires when a participant adds a wishlist item.
  - Key properties: `exchange_id`, `participant_id`, `item_id`, `has_url`, `has_price`.
- `mobile_exchange_exclusion_added`
  - Fires when an owner adds an exclusion rule.
  - Key properties: `exchange_id`, `giver_participant_id`, `receiver_participant_id`.
- `mobile_exchange_draw_completed`
  - Fires when an owner draws matches.
  - Key properties: `exchange_id`, `participant_count`.

## Business Funnel

Activation definition:
- One business workspace created.
- 20 people imported or created.
- 20 gifts tracked, or one exchange created.

Events:
- `business_signup_started`
  - Fires when a web visitor starts business signup.
  - Key properties: `use_case`, `company_provided`.
- `business_workspace_created`
  - Fires when a business workspace is created.
  - Key properties: `workspace_id`, `use_case`, `company_provided`.
- `business_workflow_updated`
  - Fires when a business admin changes the company profile workflow.
  - Key properties: `workspace_id`, `previous_use_case`, `use_case`.
- `business_sample_csv_downloaded`
  - Fires when a business signup visitor downloads a people or gifts sample CSV.
  - Key properties: `sample_type`.
- `teams_plan_started`
  - Fires when a billing-page visitor starts the Teams setup path.
  - Key properties: `source`.
- `people_csv_import_started`
  - Fires when a people CSV import starts.
  - Key properties: `owner_assigned`.
- `people_csv_template_downloaded`
  - Fires when a people CSV template is downloaded.
  - Key properties: `owner_assigned`.
- `people_csv_import_completed`
  - Fires when a people CSV import completes.
  - Key properties: `created`, `skipped`, `addresses_created`, `addresses_skipped`, `errors`, `owner_assigned`.
- `people_csv_import_failed`
  - Fires when a people CSV import request fails.
  - Key properties: `owner_assigned`.
- `people_csv_exported`
  - Fires when a web user downloads the people CSV export.
  - Key properties: `people_count`, `workspace_type`.
- `people_csv_export_failed`
  - Fires when a people CSV export request fails.
  - Key properties: `people_count`, `workspace_type`.
- `gift_csv_import_started`
  - Fires when a gift CSV import starts.
  - Key properties: `holiday_id`.
- `gift_csv_template_downloaded`
  - Fires when a gift CSV template is downloaded.
  - Key properties: `holiday_id`.
- `gift_csv_import_completed`
  - Fires when a gift CSV import completes.
  - Key properties: `holiday_id`, `created`, `people_created`, `errors`.
- `gift_csv_import_failed`
  - Fires when a gift CSV import request fails.
  - Key properties: `holiday_id`.
- `gift_csv_exported`
  - Fires when a gift CSV export succeeds.
  - Key properties: `holiday_id`, `source`.
- `gift_csv_export_failed`
  - Fires when a gift CSV export request fails.
  - Key properties: `holiday_id`, `source`.
- `gift_bulk_status_updated`
  - Fires when a web user updates the status for all currently visible gifts in a list.
  - Key properties: `holiday_id`, `status_id`, `gift_count`, `source`.
- `gift_status_changed`
  - Fires when a web user changes one gift status from the gift grid.
  - Key properties: `gift_id`, `holiday_id`, `from_status_id`, `to_status_id`, `source`.
- `gift_link_opened`
  - Fires when a web user opens a saved gift link from a gift row/card.
  - Key properties: `gift_id`, `holiday_id`, `merchant`, `source`.
- `fulfillment_report_viewed`
  - Fires when the fulfillment report view opens.
  - Key properties: `holiday_id`, `workspace_type`.

## Dashboard Cuts

Recommended first views:
- Household activation: users by completed step count.
- Quick capture quality: median `time_to_save_ms`, split by `source`.
- Exchange readiness: exchange count by latest funnel event.
- Business activation: workspace count by `use_case`, people imported, gifts imported, and exception count.
