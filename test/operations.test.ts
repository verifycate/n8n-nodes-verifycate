import { describe, expect, test } from 'vitest';

import { runVerifycateOperation } from '../nodes/Verifycate/operations';
import { issue, makeContext } from './helpers';

const baseParams = {
	resource: 'certificateIssue',
	operation: 'addRecipient',
	certificateId: 'cert-1',
	email: 'ada@example.com',
	name: 'Ada Lovelace',
	attributes: { value: { score: '95' } },
	output: 'simplified',
	selectedFields: [],
};

describe('certificate issue operations', () => {
	test('adds a recipient and returns the created issue', async () => {
		const { execute, calls } = makeContext({
			parameters: baseParams,
			responses: {
				'POST /api/v1/workspaces/current/certificates/cert-1/issues': {
					items: [issue()],
				},
			},
		});

		const result = await runVerifycateOperation(execute, 0);

		expect(calls[0].body).toEqual({
			issues: [{ email: 'ada@example.com', name: 'Ada Lovelace', attributes: { score: '95' } }],
		});
		expect(result[0]).toMatchObject({
			id: 'issue-1',
			already_enrolled: false,
			verification_url: 'https://verifycate.com/c/public-1',
		});
	});

	test('treats a duplicate as success and returns the existing issue', async () => {
		const { execute } = makeContext({
			parameters: baseParams,
			responses: {
				'POST /api/v1/workspaces/current/certificates/cert-1/issues': {
					items: [],
					results: [{ verdict: 'duplicate' }],
					rejected: ['ada@example.com'],
				},
				'GET /api/v1/workspaces/current/certificates/cert-1/issues': {
					items: [issue()],
				},
			},
		});

		const result = await runVerifycateOperation(execute, 0);

		expect(result[0]).toMatchObject({
			id: 'issue-1',
			already_enrolled: true,
		});
	});

	test('surfaces invalid recipients with the API reasons', async () => {
		const { execute } = makeContext({
			parameters: baseParams,
			responses: {
				'POST /api/v1/workspaces/current/certificates/cert-1/issues': {
					items: [],
					results: [{ verdict: 'invalid', issues: [{ message: 'Invalid email address' }] }],
					rejected: [],
				},
			},
		});

		await expect(runVerifycateOperation(execute, 0)).rejects.toThrow(
			'Verifycate rejected this recipient: Invalid email address.',
		);
	});

	test('refuses to revoke a pending certificate', async () => {
		const { execute } = makeContext({
			parameters: { ...baseParams, operation: 'revoke', reason: 'Wrong recipient' },
			responses: {
				'GET /api/v1/workspaces/current/certificates/cert-1/issues': {
					items: [issue({ status: 'pending' })],
				},
			},
		});

		await expect(runVerifycateOperation(execute, 0)).rejects.toThrow(
			'has not been issued yet, so it cannot be revoked',
		);
	});

	test('requires a meaningful revocation reason', async () => {
		const { execute } = makeContext({
			parameters: { ...baseParams, operation: 'revoke', reason: 'no' },
			responses: {
				'GET /api/v1/workspaces/current/certificates/cert-1/issues': { items: [issue()] },
			},
		});

		await expect(runVerifycateOperation(execute, 0)).rejects.toThrow(
			'The revocation reason must be at least 3 characters',
		);
	});

	test('revokes an active certificate with the audit reason', async () => {
		const { execute, calls } = makeContext({
			parameters: {
				...baseParams,
				operation: 'revoke',
				reason: 'Wrong recipient',
				publicNote: 'Superseded',
			},
			responses: {
				'GET /api/v1/workspaces/current/certificates/cert-1/issues': { items: [issue()] },
				'POST /api/v1/workspaces/current/issues/issue-1/revoke': issue({
					status: 'revoked',
					revoked_at: '2026-03-01T10:00:00Z',
				}),
			},
		});

		const result = await runVerifycateOperation(execute, 0);
		const revokeCall = calls.find((call) => call.method === 'POST' && call.url.endsWith('/revoke'));

		expect(revokeCall?.body).toEqual({ reason: 'Wrong recipient', public_note: 'Superseded' });
		expect(result[0]).toMatchObject({ status: 'revoked' });
	});

	test('refuses to replace a certificate that is not revoked', async () => {
		const { execute } = makeContext({
			parameters: { ...baseParams, operation: 'replace' },
			responses: {
				'GET /api/v1/workspaces/current/certificates/cert-1/issues': { items: [issue()] },
			},
		});

		await expect(runVerifycateOperation(execute, 0)).rejects.toThrow(
			'Only a revoked certificate can be replaced',
		);
	});

	test('lists every issue when return all is enabled', async () => {
		const { execute } = makeContext({
			parameters: { ...baseParams, operation: 'getMany', returnAll: true },
			responses: {
				'GET /api/v1/workspaces/current/certificates/cert-1/issues': {
					items: [issue(), issue({ id: 'issue-2' })],
					total: 2,
				},
			},
		});

		const result = await runVerifycateOperation(execute, 0);

		expect(result).toHaveLength(2);
		expect(result[1].id).toBe('issue-2');
	});
});

describe('request operations', () => {
	test('approval returns the issued certificate', async () => {
		const { execute, calls } = makeContext({
			parameters: {
				resource: 'request',
				operation: 'approve',
				requestId: 'req-1',
				output: 'simplified',
				selectedFields: [],
			},
			responses: {
				'POST /api/v1/workspaces/current/requests/req-1/approve': issue(),
			},
		});

		const result = await runVerifycateOperation(execute, 0);

		expect(calls[0].body).toEqual({});
		expect(result[0]).toMatchObject({
			id: 'issue-1',
			verification_url: 'https://verifycate.com/c/public-1',
		});
	});

	test('rejection sends the reviewer reason', async () => {
		const { execute, calls } = makeContext({
			parameters: {
				resource: 'request',
				operation: 'reject',
				requestId: 'req-1',
				reason: 'Missing evidence',
				output: 'raw',
			},
			responses: {
				'POST /api/v1/workspaces/current/requests/req-1/reject': {
					id: 'req-1',
					status: 'rejected',
				},
			},
		});

		const result = await runVerifycateOperation(execute, 0);

		expect(calls[0].body).toEqual({ reason: 'Missing evidence' });
		expect(result[0]).toEqual({ id: 'req-1', status: 'rejected' });
	});
});
