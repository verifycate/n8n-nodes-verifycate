import { describe, expect, test } from 'vitest';

import { Verifycate } from '../nodes/Verifycate/Verifycate.node';
import { verifycateProperties } from '../nodes/Verifycate/descriptions';
import { VerifycateTrigger } from '../nodes/VerifycateTrigger/VerifycateTrigger.node';
import { EVENT_TYPE_VALUES } from '../shared/events';
import { OPERATIONS } from '../shared/generated/api';
import openapi from '../openapi/openapi.json';
import manifest from '../package.json';

describe('OpenAPI contract', () => {
	test('every generated operation exists in the committed snapshot', () => {
		const spec = openapi;

		for (const [name, operation] of Object.entries(OPERATIONS)) {
			expect(spec.paths[operation.path], `${name} path`).toBeDefined();
			expect(
				spec.paths[operation.path][operation.method.toLowerCase()],
				`${name} method`,
			).toBeDefined();
		}
	});
});

describe('event catalogue', () => {
	test('event values are unique and start with a known namespace', () => {
		expect(new Set(EVENT_TYPE_VALUES).size).toBe(EVENT_TYPE_VALUES.length);
		for (const value of EVENT_TYPE_VALUES) {
			expect(value).toMatch(
				/^(certificate|recipient|request|correction|template|email|share|form_invite|request_form)\./,
			);
		}
	});

	test('the trigger lists every event and All Events', () => {
		const trigger = new VerifycateTrigger();
		const events = trigger.description.properties.find((property) => property.name === 'events');
		const values = (events?.options ?? []).map((option) => String(option.value));

		expect(values).toContain('*');
		for (const value of EVENT_TYPE_VALUES) expect(values).toContain(value);
	});
});

describe('node descriptions', () => {
	test('the action node declares every resource and a unique operation set per resource', () => {
		const node = new Verifycate();
		const properties = node.description.properties;
		const resource = properties.find((property) => property.name === 'resource');
		const resources = (resource?.options ?? []).map((option) => String(option.value));

		expect(resources).toEqual([
			'certificate',
			'certificateIssue',
			'correction',
			'recipient',
			'request',
		]);

		for (const resourceName of resources) {
			const operation = properties.find(
				(property) =>
					property.name === 'operation' &&
					property.displayOptions?.show?.resource?.includes(resourceName),
			);
			const values = (operation?.options ?? []).map((option) => String(option.value));
			expect(values.length, `${resourceName} operations`).toBeGreaterThan(1);
			expect(new Set(values).size).toBe(values.length);
		}
	});

	test('Add Recipient asks for the recipient email', () => {
		const node = new Verifycate();
		const email = node.description.properties.find(
			(property) =>
				property.name === 'email' &&
				property.displayOptions?.show?.operation?.includes('addRecipient'),
		);

		expect(email).toEqual(expect.objectContaining({ required: true }));
	});

	test('the action node requires the API credential and is usable as an AI tool', () => {
		const node = new Verifycate();
		expect(node.description.credentials).toEqual([
			expect.objectContaining({ name: 'verifycateApi', required: true }),
		]);
		expect(node.description.usableAsTool).toBe(true);
	});

	test('the trigger is a webhook trigger with a programmatic lifecycle', () => {
		const trigger = new VerifycateTrigger();
		expect(trigger.description.group).toContain('trigger');
		expect(trigger.description.webhooks?.[0]).toEqual(
			expect.objectContaining({ httpMethod: 'POST', responseMode: 'onReceived' }),
		);
		expect(trigger.webhookMethods?.default).toEqual(
			expect.objectContaining({
				checkExists: expect.any(Function),
				create: expect.any(Function),
				delete: expect.any(Function),
			}),
		);
	});

	test('every declared operation property has a matching output mode', () => {
		expect(verifycateProperties.some((property) => property.name === 'output')).toBe(true);
		expect(
			verifycateProperties.filter((property) => property.name === 'selectedFields'),
		).toHaveLength(5);
	});
});

describe('package manifest', () => {
	test('declares the built nodes and credential', () => {
		expect(manifest.name).toBe('@verifycate/n8n-nodes-verifycate');
		expect(manifest.keywords).toContain('n8n-community-node-package');
		expect(manifest.n8n.n8nNodesApiVersion).toBe(1);
		expect(manifest.n8n.strict).toBe(true);
		expect(manifest.n8n.credentials).toContain('dist/credentials/VerifycateApi.credentials.js');
		expect(manifest.n8n.nodes).toEqual([
			'dist/nodes/Verifycate/Verifycate.node.js',
			'dist/nodes/VerifycateTrigger/VerifycateTrigger.node.js',
		]);
	});
});
