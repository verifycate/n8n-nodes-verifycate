import { describe, expect, test } from 'vitest';

import { applyOutput, withVerificationUrl, type VerifycateResource } from '../shared/output';
import { verifySignature } from '../shared/signature';

describe('verifySignature', () => {
	const secret = 'whsec_test';
	const body = Buffer.from('{"id":"event-1"}', 'utf8');

	test('accepts a valid hex digest, with or without the sha256 prefix', async () => {
		const { createHmac } = await import('node:crypto');
		const digest = createHmac('sha256', secret).update(body).digest('hex');

		expect(verifySignature(body, digest, secret)).toBe(true);
		expect(verifySignature(body, `sha256=${digest}`, secret)).toBe(true);
	});

	test('rejects a wrong digest, malformed hex, and missing signature', () => {
		expect(verifySignature(body, 'deadbeef', secret)).toBe(false);
		expect(verifySignature(body, 'not-hex', secret)).toBe(false);
		expect(verifySignature(body, undefined, secret)).toBe(false);
	});
});

describe('output modes', () => {
	const payload = {
		id: 'issue-1',
		certificate_id: 'cert-1',
		recipient_email: 'ada@example.com',
		recipient_name: 'Ada Lovelace',
		status: 'active',
		public_id: 'public-1',
		issued_at: '2026-01-20T10:00:00Z',
		expires_at: null,
		revoked_at: null,
		attributes: { score: '95' },
		internal: 'drop-me',
	};

	test('simplified keeps the curated fields only', () => {
		const result = applyOutput(
			{ ...payload, verification_url: 'https://verifycate.com/c/public-1' },
			'certificateIssue',
			'simplified',
			[],
		);
		expect(result).toMatchObject({
			id: 'issue-1',
			recipient_email: 'ada@example.com',
			verification_url: 'https://verifycate.com/c/public-1',
		});
		expect(result).not.toHaveProperty('internal');
		expect(result).not.toHaveProperty('attributes');
	});

	test('raw and selected return exactly what was asked for', () => {
		expect(applyOutput(payload, 'certificateIssue', 'raw', [])).toEqual(payload);
		expect(applyOutput(payload, 'certificateIssue', 'selected', ['id', 'status'])).toEqual({
			id: 'issue-1',
			status: 'active',
		});
	});

	test('delete confirmations pass through unchanged', () => {
		expect(applyOutput({ id: 'issue-1', deleted: true }, 'certificateIssue', 'simplified')).toEqual(
			{
				id: 'issue-1',
				deleted: true,
			},
		);
	});

	test('adds a public verification URL when only a public id exists', () => {
		expect(withVerificationUrl({ public_id: 'abc' })).toEqual({
			public_id: 'abc',
			verification_url: 'https://verifycate.com/c/abc',
		});
	});

	test('applies to every row in a list', () => {
		const result = applyOutput(
			[payload, { ...payload, id: 'issue-2' }],
			'certificateIssue' as VerifycateResource,
			'selected',
			['id'],
		);
		expect(result).toEqual([{ id: 'issue-1' }, { id: 'issue-2' }]);
	});
});
