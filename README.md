# Verifycate for n8n

The official [n8n](https://n8n.io) community node for
[Verifycate](https://verifycate.com).

Connect a Verifycate workspace to any n8n workflow: issue a certificate when a
learner finishes a course, revoke a credential when an employee leaves, post to
Slack when a certificate is verified, or review request and correction
submissions from the tools your team already uses.

This repository is the open client for the hosted Verifycate service. The
service itself is a paid product; the node only talks to its public API.

## Status

`0.1.0`. The package is prepared for release as `n8n-nodes-verifycate` and is
being prepared for the n8n verified community node program. Verified nodes are
installable from the nodes panel on n8n Cloud and self-hosted n8n. Until the
review completes, n8n Cloud users cannot install it from the panel.

## Requirements

- n8n `1.90` or newer (self-hosted) or n8n Cloud.
- A Verifycate workspace with an API key.
- `certificates:read` scope for reads and triggers. Add `certificates:write`
  for actions that create, update, revoke, or replace credentials.
- Node.js 22 or newer when developing locally.

Create the key in Verifycate under **Workspace → API Keys**. The key identifies
its workspace, so there is no workspace slug to copy. See the
[authentication guide](https://developers.verifycate.com/docs/api/authentication)
for scopes and key management.

## Install

### Verified community node

Once the package is verified, open a workflow, choose **+**, search for
**Verifycate**, and install it. n8n Cloud admins can also enable it under
**Settings → Community nodes**.

### Self-hosted n8n

1. Open **Settings → Community nodes**.
2. Choose **Install a community node**.
3. Enter `n8n-nodes-verifycate` and confirm.

For a manual install, add the package to the custom nodes directory used by your
n8n image. The package must be installed where n8n can load it, not globally.

## Connect

1. Add a **Verifycate** action or **Verifycate Trigger** node.
2. Create a **Verifycate API** credential.
3. Paste the workspace API key.
4. Leave the base URL as `https://api.verifycate.com` unless Verifycate support
   asked you to use a staging environment.
5. Save. n8n calls `GET /api/v1/workspaces/current` to confirm the key works.

## Actions

The **Verifycate** node groups operations by resource.

| Resource              | Operations                                                                            |
| --------------------- | ------------------------------------------------------------------------------------- |
| **Certificate**       | Create, Get, Get Many, Update, Delete                                                 |
| **Certificate Issue** | Add Recipient, Get, Get Many, Issue, Update, Revoke, Replace, Reissue, Remind, Delete |
| **Recipient**         | Get, Get Many                                                                         |
| **Request**           | Get Many, Approve, Reject, Reopen                                                     |
| **Correction**        | Get Many, Approve, Reject, Reopen                                                     |

Highlights:

- **Add Recipient** enrols a recipient and issues immediately when the
  certificate delivery settings allow it. Re-enrolling an existing recipient
  returns the issue they already hold with `already_enrolled: true` instead of
  failing the workflow.
- **Revoke** requires an internal reason for the audit trail and accepts an
  optional public note shown on the revoked credential page.
- **Replace** issues a fresh credential after a revocation, with a new
  verification link. It costs one credit.
- **Attributes** are loaded from the selected certificate with n8n's resource
  mapper, so each certificate shows its own fields instead of a raw JSON box.
- **Output** can be Simplified, Raw, or Selected Fields. Simplified is the
  default and is safe to pass to an AI Agent because the action node is marked
  as usable as a tool.

Revoke, Replace, and Reissue check the current issue status first and explain
what to do instead of returning a bare API error. For example, replacing an
active certificate tells you to revoke it first.

## Trigger

**Verifycate Trigger** starts a workflow from a signed Verifycate webhook.

- Choose one or more event types, or **All Events**.
- Optionally scope the trigger to one certificate. Leave the certificate empty
  to receive the event for every certificate in the workspace.
- Signature verification is on by default.
- **Include Full Certificate Issue** fetches the latest issue and adds it as
  `issue`. If that lookup fails, the event is still delivered and
  `issue_error` explains what happened.

The output shape is the Verifycate event envelope:

```json
{
	"id": "0f2b4c1a-8d3e-4a5b-9c6d-1e2f3a4b5c6d",
	"event_type": "certificate.issued",
	"occurred_at": "2026-02-01T12:00:00Z",
	"workspace_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
	"certificate_id": "3f2c1b7a-9d4e-4c1a-9b2e-7f8e1d2c3b4a",
	"issue_id": "7c1f0a5e-0f2b-4a1c-9f4d-2b3c4d5e6f70",
	"data": {
		"recipient_email": "ada@example.com",
		"recipient_name": "Ada Lovelace",
		"certificate_name": "Leadership Essentials",
		"public_id": "9a8b7c6d5e4f",
		"public_url": "https://verifycate.com/c/9a8b7c6d5e4f",
		"issued_at": "2026-02-01T12:00:00Z",
		"expires_at": null,
		"attributes": {}
	},
	"verification_url": "https://verifycate.com/c/9a8b7c6d5e4f",
	"issue": {
		"id": "7c1f0a5e-0f2b-4a1c-9f4d-2b3c4d5e6f70",
		"status": "active",
		"verification_url": "https://verifycate.com/c/9a8b7c6d5e4f"
	}
}
```

See the [webhook guide](https://developers.verifycate.com/docs/api/webhooks/overview)
for the complete event list, payloads, retries, and signature details.

### How the subscription lifecycle works

The trigger is a real n8n webhook trigger, not a polling trigger.

1. Activating the workflow calls Verifycate and creates a webhook subscription
   with `consumer_type: "n8n"`.
2. n8n stores the subscription id and signing secret in the workflow's static
   data.
3. Deactivating the workflow or deleting the node removes the subscription.
4. On reactivation, the trigger reuses the subscription when the URL, event
   list, and certificate filter still match. Otherwise it recreates it.
5. If the workflow was imported or static data was cleared, a matching orphan
   subscription for the same webhook URL is removed before a new one is made.

The subscription is named after the workflow and node, for example
`n8n: New hire onboarding / Verifycate Trigger`, so it is easy to find under
**Settings → Webhooks** in Verifycate.

### Testing the trigger

The test URL is only registered while the editor is listening.

1. Click **Test workflow** in n8n.
2. In Verifycate, open **Settings → Webhooks** and find the subscription named
   after your workflow and node.
3. Send a test delivery for the event type you want to inspect, or complete a
   real certificate action.
4. The delivery appears in the n8n editor.

Verifycate requires a public HTTPS webhook URL. Local n8n on
`http://localhost:5678` will be rejected. Use a tunnel such as
`cloudflared tunnel --url http://localhost:5678` and set `WEBHOOK_URL` to the
public HTTPS address before starting n8n.

### Delivery guarantees

Verifycate retries failed deliveries with backoff and can deliver the same event
more than once. Put a unique constraint on the event `id` in the system that
receives the event, or record processed ids before applying side effects. n8n
does not deduplicate webhook deliveries for you.

## Example workflows

### Issue a certificate from a completed course

1. **Schedule Trigger** or your LMS webhook.
2. **Verifycate → Certificate Issue → Add Recipient**
   - Certificate: your course certificate
   - Recipient Email: the learner's email
   - Attributes: map the score and completion date
3. **Slack → Send a message** with the returned `verification_url`.

### Notify a channel when a certificate is verified

1. **Verifycate Trigger** with **Certificate: Verified**.
2. **Slack → Send a message** with `data.recipient_name` and
   `verification_url`.

### Revoke on offboarding

1. **Webhook** or **Schedule Trigger** receives the offboarding event.
2. **Verifycate → Certificate Issue → Revoke**
   - Certificate: the employee credential
   - Recipient Email: the employee's email
   - Reason: `Offboarded on {{ $now }}`
3. **Verifycate → Certificate Issue → Replace** if a corrected credential is
   needed.

## Local development

Requires Node.js 22.

```bash
npm ci
npm run check
npm run dev
```

`npm run dev` starts a local n8n instance with the node loaded. Set
`WEBHOOK_URL` to a public HTTPS URL if you want to exercise the trigger.

| Command                | Purpose                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| `npm test`             | Unit and contract tests with Vitest.                                |
| `npm run lint`         | n8n strict community-node lint, including cloud compatibility.      |
| `npm run build`        | Compile the package into `dist/`.                                   |
| `npm run check`        | Formatting, API drift, lint, build, and tests.                      |
| `npm run spec:sync`    | Refresh `openapi/openapi.json` from the published API.              |
| `npm run api:generate` | Regenerate `shared/generated/api.ts` from the snapshot.             |
| `npm run api:check`    | Fail when the generated operation map is stale.                     |
| `npm run smoke`        | Read-only check against a real workspace. Set `VERIFYCATE_API_KEY`. |

Point the node at another API host with the **Base URL** credential field, for
example `http://localhost:8080` while running the Verifycate API locally.

## Staying in sync with the API

The node only calls operations documented in the public OpenAPI document.
`openapi/openapi.json` is a committed snapshot; `scripts/generate-api.mjs`
derives every method and path from it. CI fails when the generated map is stale.
A weekly workflow refreshes the snapshot and fails when the published API has
moved ahead, so drift is caught before a customer sees it.

Adding an API call:

1. Add the operation to `OPERATIONS` in `scripts/generate-api.mjs`.
2. Run `npm run api:generate`.
3. Use it through `verifycateApiRequest(ctx, '<operation>', params, options)`
   from `shared/transport.ts`.

## Release and verification

The package is published from GitHub Actions with npm provenance. From May 1
2026, n8n requires provenance for every node submitted for verification.

```bash
npm run release
```

This lints, builds, prompts for a version bump, updates the changelog, commits,
tags, and pushes. The tag triggers `.github/workflows/publish.yml`, which
publishes to npm with `--provenance`.

One-time npm setup: in the package settings on npmjs.com, add a **Trusted
Publisher** for GitHub Actions with repository owner `verifycate`, repository
`n8n-nodes-verifycate`, and workflow `publish.yml`. No long-lived token is
needed.

After a release:

```bash
npx @n8n/scan-community-package n8n-nodes-verifycate
```

Then submit the package through the
[n8n Creator Portal](https://creators.n8n.io/nodes). The repository must stay
public, MIT licensed, and free of runtime dependencies.

## Security

- The API key is stored as an n8n credential and is never read by node code.
- Webhook deliveries are verified with HMAC-SHA256 over the raw request body.
- The signing secret is returned only when the subscription is created and is
  stored in n8n's workflow static data.
- Do not commit API keys, signing secrets, or exported workflows containing
  credentials.

Report vulnerabilities to `security@verifycate.com`. See [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).
