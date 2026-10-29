import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHookFunctions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
} from 'n8n-workflow';

import { CREDENTIAL_NAME, DEFAULT_BASE_URL, MAX_PAGE_SIZE, USER_AGENT } from './constants';
import { toNodeApiError } from './errors';
import { OPERATIONS, type ApiOperationName } from './generated/api';

export type VerifycateContext =
	| IExecuteFunctions
	| IHookFunctions
	| IWebhookFunctions
	| ILoadOptionsFunctions;

type RequestOptions = {
	body?: IDataObject;
	qs?: IDataObject;
	method?: IHttpRequestMethods;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

/** Replaces `{name}` path parameters and encodes every value. */
export function buildUrl(
	baseUrl: string | undefined,
	path: string,
	params: Record<string, string>,
): string {
	const base = trimTrailingSlash(baseUrl?.trim() || DEFAULT_BASE_URL);
	const suffix = path.replace(/\{([^}]+)\}/g, (_, key: string) => {
		const value = params[key];
		if (value === undefined || value === null || value === '') {
			throw new Error(`Missing path parameter "${key}".`);
		}
		return encodeURIComponent(value);
	});
	return `${base}${suffix}`;
}

const compact = (qs: IDataObject | undefined): IDataObject | undefined => {
	if (!qs) return undefined;
	const out: IDataObject = {};
	for (const [key, value] of Object.entries(qs)) {
		if (value === undefined || value === null || value === '') continue;
		out[key] = value;
	}
	return Object.keys(out).length > 0 ? out : undefined;
};

/**
 * Runs one documented Verifycate operation. The credential's `authenticate`
 * block adds the bearer token, so nodes never read the API key themselves.
 */
export async function verifycateApiRequest<T = IDataObject>(
	ctx: VerifycateContext,
	operationName: ApiOperationName,
	pathParams: Record<string, string> = {},
	options: RequestOptions = {},
): Promise<T> {
	const credentials = (await ctx.getCredentials(CREDENTIAL_NAME)) as { baseUrl?: string };
	const operation = OPERATIONS[operationName];
	const qs = compact(options.qs);

	const headers: IDataObject = {
		Accept: 'application/json',
		'User-Agent': USER_AGENT,
	};
	if (options.body !== undefined) headers['Content-Type'] = 'application/json';

	try {
		return (await ctx.helpers.httpRequestWithAuthentication.call(ctx, CREDENTIAL_NAME, {
			method: options.method ?? operation.method,
			url: buildUrl(credentials.baseUrl, operation.path, pathParams),
			headers,
			...(qs ? { qs } : {}),
			...(options.body !== undefined ? { body: options.body } : {}),
			json: true,
		})) as T;
	} catch (error) {
		throw toNodeApiError(ctx.getNode(), error);
	}
}

type Page<T> = {
	items?: T[] | null;
	total?: number;
	limit?: number;
	offset?: number;
};

/**
 * Reads every page of a list endpoint. Verifycate caps page size at 200, so
 * `returnAll` walks pages instead of asking for one very large response.
 */
export async function fetchAllPages<T extends IDataObject>(
	ctx: VerifycateContext,
	operationName: ApiOperationName,
	pathParams: Record<string, string> = {},
	qs: IDataObject = {},
): Promise<T[]> {
	const items: T[] = [];
	let offset = 0;

	for (;;) {
		const page = await verifycateApiRequest<Page<T>>(ctx, operationName, pathParams, {
			qs: { ...qs, limit: MAX_PAGE_SIZE, offset },
		});
		const batch = page.items ?? [];
		items.push(...batch);

		const total = Number(page.total ?? 0);
		offset += batch.length;
		if (batch.length === 0 || batch.length < MAX_PAGE_SIZE || offset >= total) break;
	}

	return items;
}
