import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	INode,
	IWebhookFunctions,
} from 'n8n-workflow';

export const NODE: INode = {
	id: 'verifycate-node',
	name: 'Verifycate',
	type: 'n8n-nodes-verifycate.verifycate',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

type Handler = (options: {
	method: string;
	url: string;
	headers?: IDataObject;
	qs?: IDataObject;
	body?: IDataObject;
}) => IDataObject | Promise<IDataObject>;

export type RequestMap = Record<string, Handler | IDataObject>;

const keyFor = (options: { method: string; url: string }) => {
	const path = decodeURIComponent(new URL(options.url).pathname);
	return `${options.method} ${path}`;
};

export const makeContext = (options: {
	parameters?: Record<string, unknown>;
	items?: IDataObject[];
	responses?: RequestMap;
	staticData?: IDataObject;
	headers?: Record<string, unknown>;
	body?: IDataObject;
	rawBody?: string;
	continueOnFail?: boolean;
	webhookUrl?: string;
}) => {
	const calls: Array<{
		method: string;
		url: string;
		headers?: IDataObject;
		qs?: IDataObject;
		body?: IDataObject;
	}> = [];
	const staticData = options.staticData ?? {};
	const responses = options.responses ?? {};
	const items = (options.items ?? [{ id: 'item-1' }]).map((json) => ({ json }));

	const getNodeParameter = (
		name: string,
		_itemIndexOrFallback?: number | unknown,
		fallbackOrOptions?: unknown,
		maybeOptions?: { extractValue?: boolean },
	) => {
		let fallback: unknown;
		let paramsOptions: { extractValue?: boolean } | undefined;
		if (typeof _itemIndexOrFallback === 'number') {
			fallback = fallbackOrOptions;
			paramsOptions = maybeOptions;
		} else {
			fallback = _itemIndexOrFallback;
			paramsOptions = fallbackOrOptions as { extractValue?: boolean } | undefined;
		}

		const value = options.parameters?.[name];
		if (value === undefined) return fallback;
		if (paramsOptions?.extractValue && typeof value === 'object' && value !== null) {
			return (value as IDataObject).value ?? fallback;
		}
		return value;
	};

	const request = async (requestOptions: {
		method: string;
		url: string;
		headers?: IDataObject;
		qs?: IDataObject;
		body?: IDataObject;
	}) => {
		calls.push(requestOptions);
		const key = keyFor(requestOptions);
		const handler = responses[key];
		if (!handler) throw new Error(`unexpected request: ${key}`);
		return typeof handler === 'function' ? handler(requestOptions) : handler;
	};

	const ctx = {
		getInputData: () => items,
		getNodeParameter,
		getCredentials: async () => ({ baseUrl: 'https://api.verifycate.example' }),
		getNode: () => NODE,
		getNodeWebhookUrl: () => options.webhookUrl ?? 'https://n8n.example/webhook/abc',
		getWorkflow: () => ({ id: 'wf-1', name: 'Test Workflow' }),
		getWorkflowStaticData: () => staticData,
		continueOnFail: () => options.continueOnFail ?? false,
		getHeaderData: () => options.headers ?? {},
		getBodyData: () => options.body ?? {},
		getRequestObject: () => ({
			rawBody: Buffer.from(options.rawBody ?? ''),
			readRawBody: async () => {},
		}),
		getResponseObject: () => ({}),
		logger: {
			debug: () => {},
			info: () => {},
			warn: () => {},
			error: () => {},
		},
		helpers: {
			httpRequestWithAuthentication: async (_credential: string, requestOptions: never) =>
				request(requestOptions),
			returnJsonArray: (data: IDataObject | IDataObject[]) =>
				(Array.isArray(data) ? data : [data]).map((json) => ({ json })),
		},
	};

	return {
		ctx,
		calls,
		staticData,
		execute: ctx as unknown as IExecuteFunctions,
		hook: ctx as unknown as IHookFunctions,
		webhook: ctx as unknown as IWebhookFunctions,
	};
};

export const issue = (overrides: IDataObject = {}): IDataObject => ({
	id: 'issue-1',
	certificate_id: 'cert-1',
	recipient_email: 'ada@example.com',
	recipient_name: 'Ada Lovelace',
	status: 'active',
	public_id: 'public-1',
	issued_at: '2026-01-20T10:00:00Z',
	expires_at: null,
	revoked_at: null,
	attributes: {},
	...overrides,
});
