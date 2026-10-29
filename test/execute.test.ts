import { describe, expect, test } from 'vitest';

import { Verifycate } from '../nodes/Verifycate/Verifycate.node';
import { makeContext } from './helpers';

const node = new Verifycate();

describe('action node execution', () => {
	test('wraps an API failure in an n8n API error with the item index', async () => {
		const { execute } = makeContext({
			parameters: {
				resource: 'certificate',
				operation: 'get',
				certificateId: 'missing',
				output: 'raw',
			},
			responses: {
				'GET /api/v1/workspaces/current/certificates/missing': () => {
					throw Object.assign(new Error('Not found'), {
						httpCode: 404,
						response: { body: { detail: 'Certificate not found' } },
					});
				},
			},
		});

		await expect(node.execute.call(execute)).rejects.toMatchObject({
			message: 'Certificate not found',
			httpCode: '404',
		});
	});

	test('returns an error item when continue on fail is enabled', async () => {
		const { execute } = makeContext({
			parameters: {
				resource: 'certificate',
				operation: 'get',
				certificateId: 'missing',
				output: 'raw',
			},
			continueOnFail: true,
			responses: {},
		});

		const [items] = await node.execute.call(execute);

		expect(items[0].json.error).toContain('unexpected request');
		expect(items[0].pairedItem).toEqual({ item: 0 });
	});
});
