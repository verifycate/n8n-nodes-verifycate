#!/usr/bin/env node
// Read-only smoke test against a real Verifycate workspace.
//
//   VERIFYCATE_API_KEY=vc_... npm run smoke
//   VERIFYCATE_API_KEY=vc_... VERIFYCATE_API_BASE_URL=http://localhost:8080 npm run smoke
//
// This exercises the same transport the node uses, so a moved route or a
// changed response shape shows up before a release.

import process from 'node:process';

import { verifycateApiRequest } from '../dist/shared/transport.js';

const apiKey = process.env.VERIFYCATE_API_KEY;
const baseUrl = process.env.VERIFYCATE_API_BASE_URL || 'https://api.verifycate.com';

if (!apiKey) {
	console.error('Set VERIFYCATE_API_KEY to a workspace API key.');
	process.exit(1);
}

const node = {
	name: 'Verifycate smoke test',
	type: '@verifycate/n8n-nodes-verifycate.verifycate',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

const ctx = {
	getCredentials: async () => ({ baseUrl }),
	getNode: () => node,
	helpers: {
		httpRequestWithAuthentication: async (_credentialType, options) => {
			const url = new URL(options.url);
			for (const [key, value] of Object.entries(options.qs ?? {})) {
				if (value !== undefined && value !== null && value !== '') {
					url.searchParams.set(key, String(value));
				}
			}

			const response = await fetch(url, {
				method: options.method,
				headers: {
					...(options.headers ?? {}),
					Authorization: `Bearer ${apiKey}`,
				},
				body: options.body ? JSON.stringify(options.body) : undefined,
			});

			const body = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw Object.assign(new Error(body.detail || body.title || `HTTP ${response.status}`), {
					httpCode: response.status,
					response: { body },
				});
			}
			return body;
		},
	},
};

const workspace = await verifycateApiRequest(ctx, 'getWorkspace');
console.log(`Workspace: ${workspace.name} (${workspace.slug})`);

const certificates = await verifycateApiRequest(
	ctx,
	'listCertificates',
	{ slug: 'current' },
	{
		qs: { limit: 5, offset: 0 },
	},
);
console.log(`Certificates: ${certificates.items?.length ?? 0} of ${certificates.total ?? 0}`);

for (const certificate of certificates.items ?? []) {
	console.log(`  - ${certificate.name} [${certificate.status}] ${certificate.id}`);
}

const firstCertificate = certificates.items?.[0];
if (firstCertificate) {
	const certificate = await verifycateApiRequest(ctx, 'getCertificate', {
		slug: 'current',
		id: firstCertificate.id,
	});
	console.log(
		`Certificate detail: ${certificate.name} (${certificate.attributes?.length ?? 0} attributes)`,
	);

	const issues = await verifycateApiRequest(
		ctx,
		'listIssues',
		{
			slug: 'current',
			id: firstCertificate.id,
		},
		{ qs: { limit: 3, offset: 0 } },
	);
	console.log(`Issues for certificate: ${issues.items?.length ?? 0} of ${issues.total ?? 0}`);
}

const recipients = await verifycateApiRequest(
	ctx,
	'listRecipients',
	{ slug: 'current' },
	{
		qs: { limit: 3, offset: 0 },
	},
);
console.log(`Recipients: ${recipients.items?.length ?? 0} of ${recipients.total ?? 0}`);

const webhooks = await verifycateApiRequest(
	ctx,
	'listWebhooks',
	{ slug: 'current' },
	{
		qs: { limit: 5, offset: 0 },
	},
);
console.log(`Webhook subscriptions: ${webhooks.items?.length ?? 0}`);

console.log('Smoke test passed.');
