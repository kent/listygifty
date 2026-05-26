# App Store Screenshot Plan

This plan keeps App Store screenshots tied to real launch promises: fast gift lists, people reminders, exchanges, and profile settings.

## Capture Routes

Run these from `apps/mobile` with a simulator open:

```bash
npm run screenshots:lists
npm run screenshots:people
npm run screenshots:exchanges
npm run screenshots:profile
```

Each command enables `EXPO_PUBLIC_SCREENSHOT_MODE=1`, uses mock app data, skips auth redirects, and routes directly to the requested tab.

## Required Shots

- Lists: show active 2026 lists, deadline reminders, and quick gift planning state.
- People: show birthdays, milestone reminders, and the schedule-reminder actions.
- Exchanges: show exchange readiness and participant progress.
- Profile: show the signed-in reviewer profile and release-ready settings surface.

## Review Checklist

- Use the production app name and icon.
- Capture on at least one 6.7-inch iPhone and one 6.1-inch iPhone size.
- Keep screenshots free of development overlays and personal data.
- Confirm every visible date is in 2026 and supports the Christmas planning story.
- Refresh screenshots after changes to lists, people, exchanges, reminders, or profile navigation.
