# Deprecated GCP deployment notes

> **Do not use this directory as a deployment or rollback runbook.**
>
> The scripts and resource names formerly documented here predate the current
> Pulumi production-only deployment. They reference retired staging services,
> old `niftygifty-*` Cloud Run names, Heroku cutover steps, and commands that no
> longer exist.

The authoritative deployment, migration, smoke-test, rollback, bootstrap, and
state-recovery instructions are in [`../pulumi/README.md`](../pulumi/README.md).
Production is project `listygifty`, region `us-central1`, and deploys only through
`npm run deploy` / the Pulumi program. Domain mappings and DNS remain
out-of-band; never run historical scripts here against production.

Files retained under `infra/gcp/` are historical implementation artifacts or
narrow secret-sync utilities, not a competing release workflow.
