# First-party marketing analytics

Listy Gifty stores product and marketing events in its own Rails/PostgreSQL stack. Web route views, mobile screen views, and the custom events in the activation dictionary flow through `POST /analytics/events`; Google Analytics, Mixpanel, and PostHog are not required.

## Measurement model

- A visitor is a stable anonymous browser installation or mobile app installation.
- A session expires after 30 minutes of inactivity.
- A user is attached when a valid Clerk bearer token accompanies an event. Earlier events for that anonymous visitor are stitched to the user.
- First touch is the visitor's earliest known channel and campaign. Last touch keeps the latest non-direct attribution.
- Supported campaign fields are `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, and `utm_content`.
- Supported ad click IDs are `gclid`, `gbraid`, `wbraid`, `fbclid`, `msclkid`, and `ttclid`.
- Channels are classified as paid search, paid social, email, affiliate, display, organic search, organic social, referral, direct, or other.
- Activation counts come from authoritative product records as well as events, so product creation remains measurable if a client event is lost.

URLs are stored without query strings. Raw IP addresses are never stored; the API retains only a daily salted hash for abuse and quality diagnosis. Event properties are size-limited and identity/secret keys are removed. Browser DNT and Global Privacy Control suppress capture. The intended maximum event retention is 25 months; automated expiry should be added when the product retention policy is finalized.

## Spend inputs

Use `admin_upsert_marketing_spend` to enter daily spend by channel and optional source, medium, campaign, currency, impressions, and clicks. Acquisition reports join these inputs to attributed visitors and signups to calculate CPC, CPA, and CAC. Keep campaign spelling consistent with UTM links.

## Useful MCP questions

These questions map directly to the marketing tools while still allowing the MCP client to interpret and combine the results:

- “How many visitors, sessions, signups, and activated users did we have in the last 30 days, and how did that compare with the previous 30?”
- “Which first-touch channels and UTM campaigns produced the most signups? Include conversion rate and CAC.”
- “Show landing pages by visitors, bounce rate, signups, and signup conversion rate for paid social.”
- “Build a funnel from `page_viewed` to `homepage_cta_clicked` to `user_signed_up`; show abandonment and median time between steps.”
- “Break down `mobile_gift_idea_captured` by `source` and show the median `time_to_save_ms`.”
- “List the product events captured in the last 90 days, with volume, unique actors, and first/last occurrence.”
- “Which weekly signup cohorts have the strongest week-1 and week-4 return rates?”
- “Show raw events for campaign `holiday-launch` after July 1, redacting sensitive properties.”
- “For support reason ‘investigate onboarding failure’, show the journey for user 123 before signup.”
- “We spent $500 on paid search campaign `holiday-launch` yesterday with 4,000 clicks. Record it, then calculate CPC and CAC.”
- “Create a goal to reach 500 monthly signups by December 31, evaluate it weekly, and tell me whether we are on pace.”
- “Set a goal for 12% visitor-to-signup conversion for paid social, then show the trend and diagnose the biggest funnel gap if it is at risk.”
- “Set a product goal of 1,000 `mobile_gift_idea_captured` events this month and evaluate all active goals.”

## Agentic goal loop

Metric goals persist the target rather than leaving it only in chat context. Each goal stores a metric, comparison (`gte` or `lte`), dates, daily/weekly/monthly granularity, segment filters, optional funnel steps, status, and notes. Evaluation returns the raw series plus current value, expected value by now, elapsed percentage, percent of target, remaining value, an achieved/on-track/at-risk/missed state, and an interpretation.

The goal loop is deliberately separated from outbound action. The MCP can inspect performance, set and revise targets, evaluate pacing, and recommend the next experiment. Email, spend entry, or destructive changes still use their own authorization and confirmation rules.

## Operational notes

The ingestion endpoint accepts at most 50 events and 256 KB per request and is rate-limited per IP. Delivery is intentionally best-effort: analytics failures never block user actions. Reporting uses indexed time ranges, PostgreSQL grouping/window functions, set-based activation checks, and bounded periods; it does not load complete page/funnel windows into application memory. MCP raw-event and individual-journey access is paginated, redacted, and audited; journey access additionally requires a reason.

Canonical product event names and properties live in [the activation event dictionary](activation-event-dictionary.md). MCP connection and key setup live in [the admin MCP guide](admin-mcp.md).
