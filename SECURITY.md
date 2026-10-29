# Security

## Reporting a vulnerability

Email `security@verifycate.com` with a description, reproduction steps, and the
affected version. Do not open a public issue for a vulnerability.

We aim to acknowledge reports within two business days and to publish a fix or
mitigation as soon as practical.

## Supported versions

Only the latest published version of `n8n-nodes-verifycate` receives security
fixes.

## Credential handling

- API keys are stored in n8n credentials and are never read by node code.
- The credential test calls `GET /api/v1/workspaces/current` with the key.
- Webhook signing secrets are returned once when a subscription is created and
  are stored in n8n workflow static data.
- Webhook deliveries are verified with HMAC-SHA256 over the raw request body
  using a constant-time comparison.

## Scope

This repository is the open client for the hosted Verifycate service. Report
issues in the Verifycate API or dashboard to the same address; they are handled
by the same security process.
