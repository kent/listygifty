# Application audit

Audit started September 7, 2026, against `7dc3071` and the current worktree.
The existing integration UI and MCP documentation edits are preserved.

## Scope and completion evidence

The source and local-runtime audit is complete. The review covered the areas
below, fixed confirmed findings and added regression coverage. Production rollout
and physical-device verification were not performed; the limits are recorded below.

| Area | Required evidence | Current status |
| --- | --- | --- |
| Rails API | Tests, RuboCop, Brakeman, dependency scan; review authentication, authorization, workspace isolation, public endpoints, validation, concurrency, billing, jobs and persistence | 563 tests pass; RuboCop, Brakeman and dependency scan clean; auth, isolation, claims, imports, billing, jobs and persistence reviewed |
| Web | Production build, lint/typecheck; review auth, workspace transitions, forms, rendering, accessibility and user flows; browser verification | Fresh production build and lint/typecheck pass; 31 unit regressions and six Playwright tests pass; auth, workspace transitions, forms, dates and application flows reviewed |
| Mobile | Independent tests/typecheck, Expo compatibility, screen and service review including auth, caches, deep links and notifications | 33 suites / 221 tests pass; types and Expo compatibility pass; auth, caches, loaders, mutations, deep links and notifications reviewed; both native exports pass |
| Shared packages and MCP | Builds, client/service contract tests, tool coverage and permission review | 15 client, four service-contract and 11 standalone MCP tests pass; transport, service envelopes, tools, resource output and permissions reviewed |
| Dependencies | Current scans for root, mobile, Ruby and infrastructure; compatibility checks for updates | All four scans clean after fixes; mobile clean-install patch verification passes |
| Infrastructure and delivery | Pulumi typecheck, scripts/workflows/configuration review, safe local validation | Pulumi typecheck, workflow actionlint and shellcheck pass; CI coverage expanded; rollout graph, configuration, release targeting and credential helpers reviewed |
| Documentation and developer workflow | Verify documented commands and complete audit evidence | Verified build/test/lint/local-preview commands; corrected deployment and release documentation; release helper dry run checked |

## Confirmed findings fixed

1. Mobile resource-cache completions could repopulate data after sign-out,
   overwrite a newer response, or remove another session's data on failure.
   Cache writes now require ownership of the current request. Bootstrap requests
   use the same ownership rule. Ten deterministic tests cover these races;
   nine failed before the fix, with the existing deduplication test passing.
2. Workspace admins could promote themselves to owner or remove existing owners
   when multiple owners existed. Ownership changes now require an owner.
3. Ordinary workspace members could list invitation tokens, including admin
   invitations. Listing credentials now requires workspace administration.
4. An invitation addressed to one email could be accepted by a different user.
   Acceptance enforces the recipient address, preserves case-insensitive matching
   and untargeted share links, and checks validity under a row lock.
5. Failed invitation regeneration expired valid links before validating the
   replacement. Regeneration now runs atomically and returns validation errors.
6. Invalid workspace membership roles raised `ArgumentError` instead of returning
   a validation response. Enum validation now rejects them through the model.
   The nine new workspace security cases had five failures and one error before
   the fixes; all pass with existing workspace tests.
7. A weekly analytics test failed on Mondays because its relative dates straddled
   two weeks. Test time is fixed and an explicit Sunday/Monday case verifies the
   application's correct bucket behavior.
8. Docker shared host `.next` and workspace `node_modules`, causing a Turbopack
   cache panic and broken modules after host dependency updates. Separate Docker
   volumes isolate both; local startup refreshes anonymous dependency volumes.
   Rebuilt containers pass authenticated browser flows.
9. The documented root `bin/lint` executable did not exist. It now runs RuboCop,
   the existing shared-build/web-lint pipeline, and the web typecheck.
10. Dependency scans initially reported 18 root, 20 mobile, and 26 infrastructure
    findings (including one critical in infrastructure). All now report zero.
    Next.js and its ESLint config are `16.3.4`; vulnerable override pins and
    transitive dependencies are updated. Metro is pinned consistently to `0.83.8`
    without changing Expo SDK 54 or React Native's React version. The patched
    query decoder requires a one-line `query-string` module-interoperability
    patch, applied by `patch-package` on install; three tests cover compatibility
    and bounded processing of hostile input. See
    [mobile patch documentation](../apps/mobile/patches/README.md).


11. Shared API requests could misreport cancellation as a timeout, retry cancelled
    requests, wait forever on token/body reads, and lose false/zero/null bodies.
    JSON and multipart requests now share deadlines, cancellation, safe error
    parsing and retry handling; each request captures its workspace and token
    getter before awaiting. Thirteen deterministic client tests pass.
12. Web workspace bootstrap, billing refreshes and workspace-data requests could
    publish obsolete responses after account/workspace changes. A shared request
    guard and identity-scoped snapshots prevent that; local edits invalidate older
    reads. The wishlist detail hook also tracks route ID changes. Bootstrap errors
    now have a retry control, and storage failures do not break navigation.
    Added a Vitest/Testing Library harness with 22 regression tests.
13. Concurrent owner demotions/removals could leave no owner, and a stale member
    instance could remove a newly promoted sole owner. Membership validation and
    deletion now acquire the workspace row lock and query persisted ownership.
    Controller authorization is rechecked under that lock. Invitations use the
    same lock order for acceptance/revocation/regeneration; accepting a deleted
    invite returns false. Five model regressions and nine security tests pass.
14. Mobile session setup now tracks Clerk user ID, clears caches on direct account
    changes, and configures credentials before screen effects. The route tree
    remounts when identity changes. An obsolete bootstrap cannot fall back to a
    new account's endpoint. Four account cache regressions pass.
15. Gift mutations did not invalidate holiday list totals or the previous holiday
    after a move/deletion. Person edits/deletions left embedded gift recipients
    stale. Related caches now expire together; four regression cases that failed
    before the fix pass.
16. Mobile focus-resource refreshes could leave the initial loading flag stuck;
    old reads could overwrite saved local data, and obsolete resource callbacks
    could mutate the current screen. Current requests settle both loading flags;
    mutation callbacks are scoped and invalidate older reads. Five tests cover
    these paths (three reproduced failures before the fix).
17. Wishlist claims truncated fractional quantities, accepted archived items,
    raised uniqueness errors, and retained purchase dates after returning to
    reserved. A shared claim service is used by authenticated HTTP, public guest
    links and Rails MCP. Model validation enforces integer quantities, uniqueness,
    archive state and purchase-date consistency under the item lock. Twelve
    validation regressions and two deterministic database concurrency tests pass.
    Existing broad response-status assertions were tightened to exact outcomes.
18. The standalone MCP client parsed CSV as JSON, omitted falsy JSON bodies,
    mishandled null errors and multipart 204s, and timed only response headers.
    CSV uses text decoding; body reads and uploads now share the request deadline.
    Six transport tests pass. Its published package remains self-contained because
    the monorepo client/types packages are private.
19. Standalone MCP handlers trusted TypeScript casts without validating incoming
    tool arguments. The SDK's JSON Schema validator now checks the advertised
    schema before dispatch. Invalid arguments are tested to make zero API calls.
20. CI omitted the new web/client tests and existing MCP tests, production web
    compilation, and infrastructure checks. It now runs those and rejects high
    or critical vulnerabilities in all three npm trees, including development
    tools. All workflows pass actionlint locally.
21. Removed the landing page's duplicate footer, connected exchange dialog
    descriptions and form labels, and made the shared footer year automatic.
    Removed the obsolete Brakeman OAuth suppression. The deploy wrapper now
    propagates a failed token lookup instead of masking it with shell `export`.

22. The mobile gift editor updated its form inside an unguarded fetcher, letting an
    obsolete route overwrite the form and refreshes discard unsaved changes.
    Forms now synchronize from accepted resource data and preserve edits to the
    same gift. Both reproduced regressions pass.
23. Repeated browser runs counted generic notification emails from previous runs.
    The exchange E2E now filters against the initial mailbox message IDs. All six
    tests pass against the existing mailbox without deleting messages.

24. Initial Clerk provisioning could commit a user without a workspace, and later
    logins never repaired it. Creation and workspace setup now commit together;
    existing incomplete accounts recover under a user row lock. New-account
    detection uses the persisted creation result to avoid treating losing
    concurrent inserts as new accounts. Two authentication regressions and a
    deterministic provisioning concurrency test pass; the full API suite passes.

25. Standalone MCP upcoming-holiday resources included past dates, and pending
    gifts included the canonical Done status. Upcoming dates now exclude the past;
    pending gifts use the configured final status position, including renamed
    statuses. Two resource tests pass. Updated the package README's stale tool
    count (67) and license text to match its existing MIT license.

26. Concurrent default address updates could leave more than one default. The
    address save now acquires its company profile lock before clearing other
    defaults. A deterministic concurrency regression fails before and passes
    after the fix.

27. Gift digests used one global notified flag, so the first successful delivery
    consumed other collaborators' updates and prevented retrying failed recipients.
    Delivery now uses each user's last successful cutoff under a user lock, limits
    changes to the current collaboration, and snapshots rows before sending. New
    changes arriving during delivery remain for the next digest. Three regressions
    cover multiple recipients, a failed recipient retry and an in-flight update.

28. Seasonal reminders crashed on dateless Christmas lists and could send obsolete
    or negative countdowns. Dateless lists use December 25; dated matches must be
    upcoming this year; elapsed countdowns are omitted. Reminders and bootstrap
    now use the configured final gift status consistently. Each user's cadence
    check and delivery runs under the user lock. Seven job regressions pass.

29. Welcome emails marked users as welcomed before delivery succeeded. The queued
    job now delivers under a user lock, then records success. Invitation welcome
    mail uses that same job and lock. Three delivery tests and a concurrent-job
    regression verify failures remain retryable and competing jobs do not resend.

30. Concurrent notification preference creation could deadlock or duplicate an
    insert. Lazy preference creation now locks and reloads the user before
    rechecking the association. A deterministic PostgreSQL regression reproduced
    the deadlock before the fix and passes afterward.

31. Mobile reminder tap handlers were never installed, and cold-start responses
    were never consumed. The signed-in root now installs and cleans up navigation
    handlers, handles the initial response, deduplicates taps, and clears consumed
    responses. Unknown payloads and unsafe route identifiers are ignored. Android
    channels are created before requesting notification permission. Four new
    navigation regressions pass; web previews skip the native response API.
    The implementation follows the [Expo SDK 54 notification lifecycle](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/).

32. CSV imports rejected extra columns while promising to ignore them. Both people
    and gift imports now retain recognized columns and ignore extras. Non-file
    payloads return a bad-request response instead of raising an exception.
    Two integration regressions cover both import endpoints.

33. Wishlist reordering crashed on absent/non-object payloads and accepted invalid
    positions. The endpoint validates the mapping, applies updates in a consistent
    order within a transaction, and returns validation errors. Item quantities and
    positions require whole numbers; failed batches roll back earlier updates.
    The wishlist integration suite passes all 27 tests.

34. Admin MCP bulk-response limits counted records but omitted the JSON envelope
    and separators. The budget now includes both. UTF-8 truncation drops an
    incomplete trailing character without exceeding the byte cap. Two boundary
    regressions pass; the existing pagination test isolates its own records.
    Admin account creation also reuses the locked workspace-provisioning method.

35. Several web pages held local state outside the shared request hook. The
    workspace provider now remounts page state when the account/workspace changes,
    detaching old loader setters and clearing forms. Refresh callbacks retained
    by a previous workspace are ignored. Two regression tests cover both paths.

36. Web calendar dates were parsed as UTC, showing the previous day west of UTC.
    A common local-calendar parser now serves gift lists, exchanges, wishes,
    invitations, recipient history and suggestions. Calendar serialization also
    preserves the local day, and regional countdowns account for daylight saving.
    Four date regressions pass in Toronto and Tokyo; all 28 web tests pass.
    Internal upgrade and recovery navigation now uses the Next.js router.

37. Non-string guest email and billing-plan payloads raised exceptions. They now
    return validation errors; regression tests cover malformed scalar/object
    inputs. Billing tests also assert exact coupon and webhook error responses.

38. Shared exchange wishlist photo uploads bypassed the API client, losing typed
    validation errors and request deadlines. Uploads now use its multipart method.
    A new shared-service contract suite checks uploads, gift request envelopes and
    encoded join links. Two upload cases failed before the fix; all four pass.
    Root tests and CI include the new suite.

39. Mobile save/join/delete completions could navigate after leaving the initiating
    screen. A shared screen-visit guard now checks asynchronous navigation and
    repeat-entry form resets across gift lists, gifts, exchanges, participants,
    wishlists and invitations. Four regressions verify normal completion and
    ignore completions after unmount, blur/refocus or route change. Three cases
    reproduced the unexpected navigation; all 221 mobile tests now pass.

40. Business workspace creation replaced an explicit `show_gift_addresses: false`
    with the default `true`. Defaults now apply only when the field is absent.
    Generated personal-workspace names could also exceed the model's 200-character
    limit and prevent provisioning; names now respect that limit. Both regressions
    pass, including persisted settings and owner membership checks.

41. The README named removed deploy workflows and nonexistent preview/submission
    commands, described disabled staging as operational, and recommended the
    legacy immediate-tag helper as the normal release flow. It now matches the
    current scripts and production-only infrastructure and explains the reviewed
    merge/deploy/TestFlight sequence. The release runbook distinguishes the
    legacy helper and its dry run. The helper dry run and EAS command discovery
    were checked without queuing a build or submission.

42. Web CSV downloads and public unsubscribe requests bypassed shared transport
    deadlines and error handling. Downloads now use a bounded blob response while
    retaining server filenames and releasing temporary browser URLs. Unsubscribe
    requests use a separate unauthenticated client and encoded tokens. Two client
    tests and three web service tests verify body deadlines, download cleanup,
    typed errors, false preference values and absence of account credentials.

Dependency sources include the [Next.js August security release](https://nextjs.org/blog/august-2026-security-release)
and the [query-decoder advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).

## Verification limits

- No production deployment, TestFlight build, App Store submission or remote
  configuration change was performed. Production credentials, live billing and
  the rollout itself were reviewed through code/configuration and local tests.
- Native exports and Jest regressions verify the mobile changes. Notification
  delivery/taps on a physical device remain a release validation step.
- Credentialed Playwright runs were executed locally against Clerk test instances.
  CI runs the automated unit, API, build and dependency gates; it does not yet run
  those browser flows because test-instance credentials are not configured there.
  Fork pull requests receive no new credentials from this audit.
- Seasonal delivery is serialized between application jobs. As with ordinary
  email delivery, a process crash after provider acceptance but before committing
  the success marker can still lead to a duplicate on a later retry.
- Two intentional Brakeman mass-assignment suppressions remain. Admin mutation
  attributes are constrained by the reviewed catalog, authorization and audit log.

## Current verification

Final logs use `/tmp/listygifty-audit-*`; these checks run against the final source
changes unless explicitly described as earlier clean-install verification.

- Rails: 563 tests, 2,728 assertions; no failures, errors or skips. Deterministic
  concurrency tests ran on PostgreSQL in the separate `niftygifty_test` database.
- Mobile: 221 tests in 33 suites; typecheck and Expo dependency compatibility pass.
- Root JavaScript tests: 15 API-client, four shared-service, 31 web and 11 MCP tests.
  CI and Turbo pass the Toronto timezone to the date regressions; Tokyo date tests
  also pass locally.
- Web production build: all five Turbo build tasks pass with zero cache hits.
- `./bin/lint`: RuboCop and web ESLint/typecheck pass. No lint warnings remain.
- Brakeman: zero warnings, two intentional suppressions. Bundler Audit: zero findings.
- Root, mobile and infrastructure npm dependency audits: zero findings in all three.
- Pulumi typecheck, all workflow files through `actionlint`, and the reviewed
  local-preview/lint/deploy/credential/smoke scripts through `shellcheck`: pass.
- Playwright: six tests pass (53.9s), including Clerk setup, five-user and two-user
  exchange flows, real local mail, desktop/mobile settings, clipboard/overflow and
  a Toronto calendar-date assertion.
- Local worker after browser tests: zero failed Solid Queue jobs.
- Both native Hermes bundles export successfully; the current completion export
  is `/tmp/listygifty-audit-mobile-export-completion`.
- Earlier clean root `npm ci` and mobile `npm ci --legacy-peer-deps` succeeded.
  Mobile's compatibility patch applied successfully and decoder regressions passed.
- The release helper's `patch --dry-run` succeeds without changing versions or
  creating commits, tags or builds. EAS help confirmed the supported submission
  alias and exposed the nonexistent `submit:list` command removed from the README.
- `git diff --check`: clean.

Both local Clerk configurations are test instances. An unrelated host PostgreSQL
service owns localhost:5432; database checks used the Docker network without
changing that service. The API, web, worker, Mailpit and PostgreSQL preview stack
remain available locally. No deployment or release was performed.
