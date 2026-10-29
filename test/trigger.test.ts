import { createHmac } from 'node:crypto';

import { describe, expect, test } from 'vitest';

import { VerifycateTrigger } from '../nodes/VerifycateTrigger/VerifycateTrigger.node';
import { issue, makeContext } from './helpers';

const trigger = new VerifycateTrigger();
const lifecycle = trigger.webhookMethods.default;

const webhookPayload = {
	id: 'event-1',
	event_type: 'certificate.issued',
	occurred_at: '2026-02-01T12:00:00Z',
	workspace_id: 'ws-1',
	issue_id: 'issue-1',
	certificate_id: 'cert-1',
	data: {
		recipient_email: 'ada@example.com',
		recipient_name: 'Ada Lovelace',
		public_id: 'public-1',
		public_url: 'https://verifycate.com/c/public-1',
	},
};

describe('trigger subscription lifecycle', () => {
	test('creates a subscription with the n8n consumer type and certificate filter', async () => {
		const { hook, calls, staticData } = makeContext({
			parameters: {
				events: ['certificate.issued', 'certificate.revoked'],
				certificateId: 'cert-1',
			},
			responses: {
				'GET /api/v1/workspaces/current/webhooks': { items: [] },
				'POST /api/v1/workspaces/current/webhooks': { id: 'hook-1', secret: 'whsec_1' },
			},
		});

		await expect(lifecycle.create.call(hook)).resolves.toBe(true);

		const createCall = calls.find((call) => call.method === 'POST');
		expect(createCall?.body).toEqual({
			name: 'n8n: Test Workflow / Verifycate',
			url: 'https://n8n.example/webhook/abc',
			event_types: ['certificate.issued', 'certificate.revoked'],
			consumer_type: 'n8n',
			filters: { certificate_id: 'cert-1' },
		});
		expect(staticData).toEqual({ webhookId: 'hook-1', webhookSecret: 'whsec_1' });
	});

	test('normalizes All Events and removes a stale subscription for the same URL', async () => {
		const { hook, calls } = makeContext({
			parameters: {
				events: ['certificate.issued', '*'],
				certificateId: '',
			},
			responses: {
				'GET /api/v1/workspaces/current/webhooks': {
					items: [
						{ id: 'stale', url: 'https://n8n.example/webhook/abc', consumer_type: 'n8n' },
						{ id: 'other', url: 'https://n8n.example/webhook/other', consumer_type: 'n8n' },
					],
				},
				'DELETE /api/v1/workspaces/current/webhooks/stale': {},
				'POST /api/v1/workspaces/current/webhooks': { id: 'hook-2', secret: 'whsec_2' },
			},
		});

		await lifecycle.create.call(hook);

		const createCall = calls.find((call) => call.method === 'POST');
		expect(createCall?.body).toMatchObject({ event_types: ['*'] });
		expect(createCall?.body).not.toHaveProperty('filters');
		expect(calls.some((call) => call.url.endsWith('/webhooks/stale'))).toBe(true);
		expect(calls.some((call) => call.url.endsWith('/webhooks/other'))).toBe(false);
	});

	test('rejects a local HTTP webhook URL', async () => {
		const { hook } = makeContext({
			parameters: { events: ['certificate.issued'] },
			webhookUrl: 'http://localhost:5678/webhook/abc',
		});

		await expect(lifecycle.create.call(hook)).rejects.toThrow(
			'Verifycate requires a public HTTPS webhook URL',
		);
	});

	test('reuses a subscription only when URL, events, and filter still match', async () => {
		const staticData = { webhookId: 'hook-1', webhookSecret: 'whsec_1' };
		const matching = {
			'GET /api/v1/workspaces/current/webhooks/hook-1': {
				id: 'hook-1',
				url: 'https://n8n.example/webhook/abc',
				enabled: true,
				event_types: ['certificate.issued'],
				filters: { certificate_id: 'cert-1' },
			},
		};

		const first = makeContext({
			parameters: { events: ['certificate.issued'], certificateId: 'cert-1' },
			responses: matching,
			staticData: { ...staticData },
		});
		await expect(lifecycle.checkExists.call(first.hook)).resolves.toBe(true);

		const changed = makeContext({
			parameters: { events: ['certificate.revoked'], certificateId: 'cert-1' },
			responses: matching,
			staticData: { ...staticData },
		});
		await expect(lifecycle.checkExists.call(changed.hook)).resolves.toBe(false);
	});

	test('does not call the API when there is no stored subscription', async () => {
		const { hook, calls } = makeContext({
			parameters: { events: ['certificate.issued'] },
		});

		await expect(lifecycle.checkExists.call(hook)).resolves.toBe(false);
		expect(calls).toHaveLength(0);
	});

	test('deletes the subscription and clears static data', async () => {
		const { hook, calls, staticData } = makeContext({
			parameters: { events: ['certificate.issued'] },
			staticData: { webhookId: 'hook-1', webhookSecret: 'whsec_1' },
			responses: { 'DELETE /api/v1/workspaces/current/webhooks/hook-1': {} },
		});

		await expect(lifecycle.delete.call(hook)).resolves.toBe(true);
		expect(calls[0].url).toContain('/webhooks/hook-1');
		expect(staticData).toEqual({});
	});
});

describe('trigger webhook delivery', () => {
	const secret = 'whsec_1';
	const rawBody = JSON.stringify(webhookPayload);
	const signature = createHmac('sha256', secret).update(rawBody).digest('hex');

	test('verifies the signature and returns the event with a verification URL', async () => {
		const { webhook } = makeContext({
			parameters: { verifySignature: true, includeIssue: false },
			staticData: { webhookId: 'hook-1', webhookSecret: secret },
			body: webhookPayload,
			rawBody,
			headers: { 'x-verifycate-signature': signature },
		});

		const response = await trigger.webhook.call(webhook);

		expect(response.workflowData?.[0][0].json).toMatchObject({
			id: 'event-1',
			event_type: 'certificate.issued',
			verification_url: 'https://verifycate.com/c/public-1',
		});
	});

	test('rejects a delivery with a wrong signature', async () => {
		const { webhook } = makeContext({
			parameters: { verifySignature: true, includeIssue: false },
			staticData: { webhookId: 'hook-1', webhookSecret: secret },
			body: webhookPayload,
			rawBody,
			headers: { 'x-verifycate-signature': 'deadbeef' },
		});

		await expect(trigger.webhook.call(webhook)).rejects.toThrow(
			'Verifycate webhook signature did not match',
		);
	});

	test('enriches the event with the full certificate issue', async () => {
		const { webhook } = makeContext({
			parameters: { verifySignature: true, includeIssue: true },
			staticData: { webhookId: 'hook-1', webhookSecret: secret },
			body: webhookPayload,
			rawBody,
			headers: { 'x-verifycate-signature': signature },
			responses: {
				'GET /api/v1/workspaces/current/issues/issue-1': issue(),
			},
		});

		const response = await trigger.webhook.call(webhook);
		const json = response.workflowData?.[0][0].json as Record<string, unknown>;

		expect(json.issue).toMatchObject({
			id: 'issue-1',
			verification_url: 'https://verifycate.com/c/public-1',
		});
	});

	test('still delivers the event when enrichment fails', async () => {
		const { webhook } = makeContext({
			parameters: { verifySignature: true, includeIssue: true },
			staticData: { webhookId: 'hook-1', webhookSecret: secret },
			body: webhookPayload,
			rawBody,
			headers: { 'x-verifycate-signature': signature },
			responses: {},
		});

		const response = await trigger.webhook.call(webhook);
		const json = response.workflowData?.[0][0].json as Record<string, unknown>;

		expect(json.id).toBe('event-1');
		expect(json.issue_error).toBeDefined();
	});
});
