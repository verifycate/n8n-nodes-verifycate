import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { eventOptions } from '../../shared/events';
import { operationError } from '../../shared/errors';
import { withVerificationUrl } from '../../shared/output';
import { verifySignature } from '../../shared/signature';
import { verifycateApiRequest } from '../../shared/transport';
import { searchCertificates } from '../Verifycate/methods/listSearch';

const SLUG = 'current';

type WebhookPage = { items?: IDataObject[] | null };

const normalizeEvents = (value: unknown): string[] => {
	const values = Array.isArray(value) ? value.map(String).filter(Boolean) : [];
	if (values.includes('*')) return ['*'];
	return [...new Set(values)].sort();
};

const sameEvents = (left: unknown, right: unknown): boolean =>
	JSON.stringify(normalizeEvents(left)) === JSON.stringify(normalizeEvents(right));

const signatureHeader = (headers: Record<string, unknown>): string | undefined => {
	const value = headers['x-verifycate-signature'] ?? headers['X-Verifycate-Signature'];
	if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : undefined;
	return typeof value === 'string' ? value : undefined;
};

export class VerifycateTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Verifycate Trigger',
		name: 'verifycateTrigger',
		icon: {
			light: 'file:../../icons/verifycate.svg',
			dark: 'file:../../icons/verifycate.dark.svg',
		},
		group: ['trigger'],
		version: 1,
		subtitle: '={{ $parameter["events"].join(", ") }}',
		description: 'Starts the workflow when Verifycate events occur',
		defaults: {
			name: 'Verifycate Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'verifycateApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				default: ['certificate.issued'],
				required: true,
				options: eventOptions,
				description: 'The Verifycate events that start this workflow',
			},
			{
				displayName: 'Certificate',
				name: 'certificateId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				description:
					'Only start for one certificate. Leave empty to receive the selected events for every certificate in the workspace.',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a certificate...',
						typeOptions: {
							searchListMethod: 'searchCertificates',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 3f2c1b7a-9d4e-4c1a-9b2e-7f8e1d2c3b4a',
					},
				],
			},
			{
				displayName: 'Verify Signature',
				name: 'verifySignature',
				type: 'boolean',
				default: true,
				description:
					'Whether to reject deliveries whose X-Verifycate-Signature header does not match the subscription secret',
			},
			{
				displayName: 'Include Full Certificate Issue',
				name: 'includeIssue',
				type: 'boolean',
				default: true,
				description:
					'Whether to fetch the latest certificate issue and include it as issue in the output',
			},
			{
				displayName:
					'Activate the workflow, then send a test delivery from Verifycate under Settings → Webhooks. The subscription is named after this workflow and node. Real certificate activity also triggers the workflow.',
				name: 'testNotice',
				type: 'notice',
				default: '',
			},
		],
	};

	methods = {
		listSearch: {
			searchCertificates,
		},
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const webhookId = webhookData.webhookId;
				if (typeof webhookId !== 'string' || webhookId === '') return false;
				if (typeof webhookData.webhookSecret !== 'string' || webhookData.webhookSecret === '') {
					return false;
				}

				const url = this.getNodeWebhookUrl('default');
				if (!url) return false;

				const certificateId = String(
					this.getNodeParameter('certificateId', '', { extractValue: true }) ?? '',
				).trim();
				const events = normalizeEvents(this.getNodeParameter('events', []));

				try {
					const webhook = await verifycateApiRequest<IDataObject>(this, 'getWebhook', {
						slug: SLUG,
						webhookID: webhookId,
					});

					const filters = (webhook.filters as IDataObject | undefined) ?? {};
					const remoteCertificateId =
						typeof filters.certificate_id === 'string' ? filters.certificate_id : '';

					return (
						webhook.url === url &&
						webhook.enabled !== false &&
						sameEvents(webhook.event_types, events) &&
						remoteCertificateId === certificateId
					);
				} catch (error) {
					this.logger.warn(
						`Verifycate: could not inspect webhook ${webhookId}: ${(error as Error).message}`,
					);
					return false;
				}
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const url = this.getNodeWebhookUrl('default');
				if (!url) {
					throw operationError(
						this.getNode(),
						'n8n did not provide a webhook URL for this trigger.',
						'Check the n8n WEBHOOK_URL configuration and try again.',
					);
				}
				if (!url.startsWith('https://')) {
					throw operationError(
						this.getNode(),
						'Verifycate requires a public HTTPS webhook URL.',
						'Set WEBHOOK_URL to a public HTTPS address, or run n8n behind a tunnel while developing locally.',
					);
				}

				const events = normalizeEvents(this.getNodeParameter('events', []));
				if (events.length === 0) {
					throw operationError(
						this.getNode(),
						'Select at least one event for the trigger.',
						'Open the trigger and choose the Verifycate events that should start this workflow.',
					);
				}
				const certificateId = String(
					this.getNodeParameter('certificateId', '', { extractValue: true }) ?? '',
				).trim();

				// Re-imported workflows and cleared static data can leave the old
				// subscription behind. Remove matching n8n subscriptions for this URL
				// before creating a replacement.
				try {
					const page = await verifycateApiRequest<WebhookPage>(
						this,
						'listWebhooks',
						{ slug: SLUG },
						{ qs: { limit: 50, offset: 0 } },
					);
					for (const hook of page.items ?? []) {
						if (
							hook.id !== webhookData.webhookId &&
							hook.url === url &&
							hook.consumer_type === 'n8n' &&
							typeof hook.id === 'string'
						) {
							await verifycateApiRequest(this, 'deleteWebhook', {
								slug: SLUG,
								webhookID: hook.id,
							});
						}
					}
				} catch (error) {
					// Cleanup is best effort. A stale subscription is less harmful than
					// failing activation because the listing endpoint was unavailable.
					this.logger.warn(
						`Verifycate: could not clean up stale subscriptions: ${(error as Error).message}`,
					);
				}

				const name = `n8n: ${this.getWorkflow().name} / ${this.getNode().name}`.slice(0, 120);
				const body: IDataObject = {
					name,
					url,
					event_types: events,
					consumer_type: 'n8n',
					...(certificateId ? { filters: { certificate_id: certificateId } } : {}),
				};

				const webhook = await verifycateApiRequest<IDataObject>(
					this,
					'createWebhook',
					{ slug: SLUG },
					{ body },
				);

				const id = webhook.id;
				const secret = webhook.secret;
				if (typeof id !== 'string' || id === '' || typeof secret !== 'string' || secret === '') {
					throw operationError(
						this.getNode(),
						'Verifycate created the subscription but did not return a signing secret.',
						'Remove the subscription in Verifycate under Settings → Webhooks, then reactivate the workflow.',
					);
				}

				webhookData.webhookId = id;
				webhookData.webhookSecret = secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const webhookId = webhookData.webhookId;
				if (typeof webhookId !== 'string' || webhookId === '') return true;

				try {
					await verifycateApiRequest(this, 'deleteWebhook', {
						slug: SLUG,
						webhookID: webhookId,
					});
				} catch (error) {
					this.logger.warn(
						`Verifycate: could not delete webhook ${webhookId}: ${(error as Error).message}`,
					);
					return false;
				}

				delete webhookData.webhookId;
				delete webhookData.webhookSecret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const data = this.getBodyData();
		if (typeof data.id !== 'string' || typeof data.event_type !== 'string') {
			throw operationError(
				this.getNode(),
				'Verifycate sent an event without an id or event type.',
				'Check the delivery payload in Verifycate under Settings → Webhooks.',
			);
		}

		const shouldVerify = this.getNodeParameter('verifySignature', true) as boolean;
		if (shouldVerify) {
			const webhookData = this.getWorkflowStaticData('node');
			const secret = webhookData.webhookSecret;
			if (typeof secret !== 'string' || secret === '') {
				throw operationError(
					this.getNode(),
					'The trigger has no signing secret for this subscription.',
					'Deactivate and reactivate the workflow so n8n can create a new subscription.',
				);
			}

			const request = this.getRequestObject() as unknown as {
				rawBody?: Buffer;
				readRawBody?: () => Promise<void>;
			};
			if (!request.rawBody && typeof request.readRawBody === 'function') {
				await request.readRawBody();
			}
			const rawBody = request.rawBody;
			if (!rawBody) {
				throw operationError(
					this.getNode(),
					'n8n did not expose the raw webhook body needed to verify the signature.',
					'Update n8n to a version that provides the raw request body, or disable signature verification for this trigger.',
				);
			}

			const headers = this.getHeaderData() as Record<string, unknown>;
			const signature = signatureHeader(headers);
			if (!verifySignature(rawBody, signature, secret)) {
				throw operationError(
					this.getNode(),
					'Verifycate webhook signature did not match.',
					'Deactivate and reactivate the workflow so n8n can create a new subscription and secret.',
				);
			}
		}

		const event: IDataObject = { ...data };
		const payload = (data.data as IDataObject | undefined) ?? {};
		if (typeof payload.public_url === 'string' && payload.public_url !== '') {
			event.verification_url = payload.public_url;
		}

		const includeIssue = this.getNodeParameter('includeIssue', true) as boolean;
		if (includeIssue && typeof data.issue_id === 'string' && data.issue_id !== '') {
			try {
				const issue = await verifycateApiRequest<IDataObject>(this, 'getIssue', {
					slug: SLUG,
					issueID: data.issue_id,
				});
				event.issue = withVerificationUrl(issue);
				if (typeof event.verification_url !== 'string' && typeof event.issue === 'object') {
					const issueUrl = (event.issue as IDataObject).verification_url;
					if (typeof issueUrl === 'string') event.verification_url = issueUrl;
				}
			} catch (error) {
				// The event itself is valid. Never drop a delivery because enrichment
				// failed; Verifycate would retry and eventually mark it permanently failed.
				event.issue_error = (error as Error).message;
			}
		}

		return {
			workflowData: [this.helpers.returnJsonArray(event)],
		};
	}
}
