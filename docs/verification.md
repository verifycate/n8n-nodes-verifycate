# Verification and release checklist

This is the operational checklist for publishing the package and submitting it
to the n8n verified community node program.

## One-time npm setup

1. Create the `verifycate` npm organization.
2. Create the package by publishing the first version once (see First publish).
3. On npmjs.com, open the package settings.
4. Under **Publish access → Trusted Publishers**, add a GitHub Actions
   publisher:
   - Repository owner: `verifycate`
   - Repository name: `n8n-nodes-verifycate`
   - Workflow name: `publish.yml`
5. Leave `NPM_TOKEN` unset in GitHub. GitHub's OIDC token is used for
   provenance.

If you used a one-off npm token to bootstrap the first publish, revoke it after
the trusted publisher is configured.

## Status

- `0.1.0` was published once to bootstrap the package. It has no provenance and
  is not the submission candidate.
- The GitHub Actions trusted publisher is configured for this repository and
  `publish.yml`.
- `0.1.1` is the current submission candidate and must be published by the
  `Publish` workflow.

## First publish

Trusted Publishing needs the package to exist before it can be configured, so
the first version was published once with the account's 2FA prompt. This is
only needed for a brand-new package:

```bash
npm run build
npm publish --access public --ignore-scripts
```

Enter the one-time password when npm asks. Do not commit an npm token. This
first version will not have provenance; publish the next patch version through
GitHub Actions and submit that version for verification.

## Trusted publisher

The npm website is the reliable path because npm requires 2FA for this change.
Add the trusted publisher under the package settings using the values above.

On npm CLI 11.15 or newer, after the package exists, the equivalent is:

```bash
npm trust github --file publish.yml --repo verifycate/n8n-nodes-verifycate --allow-publish -- @verifycate/n8n-nodes-verifycate
```

npm prompts for 2FA. The package is read from the current directory's
`package.json`.

## Release

```bash
npm ci
npm run check
npm run release
```

`npm run release` lints, builds, bumps the version, updates the changelog,
commits, tags, and pushes. The tag triggers `publish.yml`, which publishes with
`--provenance`.

Then confirm the published package:

```bash
npm view @verifycate/n8n-nodes-verifycate version dist.integrity
npx @n8n/scan-community-package @verifycate/n8n-nodes-verifycate
```

## Submit to the Creator Portal

Open <https://creators.n8n.io/nodes> and provide:

- npm package name: `@verifycate/n8n-nodes-verifycate`
- public repository: <https://github.com/verifycate/n8n-nodes-verifycate>
- License: MIT
- Documentation: the repository README and the Verifycate developer docs
- Test instructions: see below
- Contact: `hello@verifycate.com`

Before submitting, confirm:

- [ ] `npm run check` passes locally and in GitHub Actions.
- [ ] The package is published from GitHub Actions with provenance.
- [ ] `npx @n8n/scan-community-package @verifycate/n8n-nodes-verifycate` passes.
- [ ] The repository is public, MIT licensed, and has no runtime dependencies.
- [ ] The README covers installation, credentials, actions, triggers, and
      example workflows.
- [ ] The node and trigger appear in the n8n editor, both icons render in light
      and dark mode, and the certificate dropdown and attribute mapper load.
- [ ] Trigger activation creates a Verifycate subscription, a test delivery
      reaches n8n, deactivation removes the subscription, and reactivation
      reuses it.
- [ ] A real `certificate.issued` event reaches a workflow.
- [ ] One action from each resource succeeds against a test workspace.

## Review test workspace

Use a dedicated Verifycate workspace with:

- one active certificate with at least two attributes
- one draft certificate
- one recipient with an active issue
- one revoked issue
- one pending certificate request
- one pending correction request

Do not use customer data. Rotate the API key after the review.

## After verification

- Update the README status from pre-verification to available.
- Add the node to the Verifycate integrations page and developer docs.
- Add an `n8n` API key preset in the Verifycate dashboard.
- Add n8n workflow templates to the n8n template gallery.
- Monitor the repository issues and the n8n Creator Portal messages.

## Support runbook

Common reports and the first checks:

| Report                          | Check                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| Credential test fails           | Key revoked or missing `certificates:read`; base URL should be `https://api.verifycate.com` |
| Activate fails with HTTPS error | `WEBHOOK_URL` is not public HTTPS; use a tunnel for local development                       |
| Trigger activates but no events | Subscription event list and certificate filter; delivery log in Verifycate                  |
| Signature failures              | Deactivate and reactivate so n8n creates a fresh subscription and secret                    |
| Duplicate subscription          | Trigger cleanup removes matching n8n subscriptions for the same webhook URL on activation   |
