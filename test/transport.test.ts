import { describe, expect, test } from 'vitest';

import { toNodeApiError } from '../shared/errors';
import { buildUrl, fetchAllPages, verifycateApiRequest } from '../shared/transport';
import { makeContext } from './helpers';

describe('buildUrl', () => {
	test('encodes path parameters and trims the base URL', () => {
		expect(
			buildUrl('https://api.verifycate.example/', '/api/v1/workspaces/{slug}/recipients/{email}', {
				slug: 'current',
				email: 'ada+test@example.com',
			}),
		).toBe(
			'https://api.verifycate.example/api/v1/workspaces/current/recipients/ada%2Btest%40example.com',
		);
	});

	test('falls back to the production host and rejects missing parameters', () => {
		expect(buildUrl(undefined, '/api/v1/workspaces/current', {})).toBe(
			'https://api.verifycate.com/api/v1/workspaces/current',
		);
		expect(() => buildUrl(undefined, '/api/v1/workspaces/{slug}', {})).toThrow(
			'Missing path parameter "slug"',
		);
	});
});

describe('verifycateApiRequest', () => {
	test('sends method, URL, headers, query, and body', async () => {
		const { execute, calls } = makeContext({
			responses: {
				'POST /api/v1/workspaces/current/certificates/cert-1/issues': { items: [] },
			},
		});

		await verifycateApiRequest(
			execute,
			'importIssues',
			{ slug: 'current', id: 'cert-1' },
			{ qs: { dry: true }, body: { issues: [] } },
		);

		expect(calls[0]).toEqual(
			expect.objectContaining({
				method: 'POST',
				url: 'https://api.verifycate.example/api/v1/workspaces/current/certificates/cert-1/issues',
				headers: expect.objectContaining({
					Accept: 'application/json',
					'User-Agent': 'verifycate-n8n',
					'Content-Type': 'application/json',
				}),
				qs: { dry: true },
				body: { issues: [] },
			}),
		);
	});

	test('drops empty query values', async () => {
		const { execute, calls } = makeContext({
			responses: { 'GET /api/v1/workspaces/current/certificates': { items: [] } },
		});

		await verifycateApiRequest(
			execute,
			'listCertificates',
			{ slug: 'current' },
			{ qs: { search: '', limit: 50, offset: 0 } },
		);

		expect(calls[0].qs).toEqual({ limit: 50, offset: 0 });
	});
});

describe('fetchAllPages', () => {
	test('walks pages until the total is reached', async () => {
		const firstPage = Array.from({ length: 200 }, (_, index) => ({ id: `item-${index}` }));
		const { execute, calls } = makeContext({
			responses: {
				'GET /api/v1/workspaces/current/certificates': (options) =>
					options.qs?.offset === 0
						? { items: firstPage, total: 201 }
						: { items: [{ id: 'item-200' }], total: 201 },
			},
		});

		const items = await fetchAllPages(execute, 'listCertificates', { slug: 'current' });

		expect(items).toHaveLength(201);
		expect(calls).toHaveLength(2);
		expect(calls[1].qs).toEqual({ limit: 200, offset: 200 });
	});
});

describe('error mapping', () => {
	test('uses the problem detail and adds a rate-limit hint', () => {
		const error = toNodeApiError(
			{
				name: 'Verifycate',
				type: '@verifycate/n8n-nodes-verifycate.verifycate',
				typeVersion: 1,
				position: [0, 0],
				parameters: {},
			},
			{
				httpCode: 429,
				response: { body: { detail: 'Too many requests' } },
			},
		);

		expect(error.httpCode).toBe('429');
		expect(error.message).toBe('Too many requests');
		expect(error.description).toContain('rate limiting');
	});
});
