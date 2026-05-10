# Security Policy

## Reporting a vulnerability

If you've found a security vulnerability in this codebase or in the running
[listygifty.com](https://listygifty.com) service, please **do not open a
public GitHub issue**. Instead, email **security@listygifty.com** with:

- A description of the vulnerability and its impact
- Reproduction steps (URLs, payloads, expected vs. actual behaviour)
- Your contact info if you'd like credit

We aim to acknowledge reports within 2 business days and provide an initial
assessment within 5 business days. Critical issues will be remediated and a
patch shipped as quickly as possible; lower-severity issues are prioritised
against active product work.

## Supported versions

Only the `main` branch is actively maintained and deployed. Older branches and
tags are not patched.

## Out of scope

The following are generally considered out of scope unless they enable a
meaningful compromise:

- Reports that require physical access to a victim's device
- Self-XSS / clickjacking on pages without sensitive actions
- Missing HTTP security headers without a demonstrated impact
- Findings in third-party services we use (Clerk, Stripe, Postmark, Cloud
  Run) — please report to the upstream vendor

## Hall of fame

Credit is given on request for valid reports. We do not currently run a paid
bug bounty.

## Secrets and rotation

This repo is public. We rotate any credential that lands in a commit, even
accidentally. If you discover what looks like a secret in tracked code,
please report it the same way — we'll rotate the value and remove the
reference from history if it has demonstrable value remaining.
