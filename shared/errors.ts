import type { IDataObject, INode, JsonObject } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

const HINTS: Record<number, string> = {
	400: 'Check the values sent by this step. Verifycate rejected the request as invalid.',
	401: 'Verifycate rejected the API key. Create a new key in Workspace → API Keys, then reconnect the credential.',
	402: 'The workspace may be out of credits, or this step uses a feature that is not available on the current plan.',
	403: 'The API key is missing a scope this step needs. Reconnect with certificates:read and certificates:write.',
	404: 'The record may have been deleted, or the API key belongs to a different workspace.',
	409: 'The record changed while this step was running. Reload the data and try again.',
	422: 'Verifycate could not process the submitted values. Check the request body and required fields.',
	429: 'Verifycate is rate limiting this workspace. Retry the step after the period in the Retry-After header.',
	500: 'Verifycate returned a server error. Retry the step, then contact support if it keeps failing.',
	502: 'Verifycate is temporarily unavailable. Retry the step in a moment.',
	503: 'Verifycate is temporarily unavailable. Retry the step in a moment.',
	504: 'Verifycate timed out. Retry the step in a moment.',
};

const bodyOf = (error: unknown): IDataObject => {
	if (typeof error !== 'object' || error === null) return {};
	const candidate = error as {
		response?: { body?: unknown };
		cause?: { response?: { body?: unknown } };
	};
	const body = candidate.response?.body ?? candidate.cause?.response?.body;
	return typeof body === 'object' && body !== null ? (body as IDataObject) : {};
};

const statusOf = (error: unknown): number => {
	if (typeof error !== 'object' || error === null) return 0;
	const candidate = error as { httpCode?: unknown; statusCode?: unknown; code?: unknown };
	const value = candidate.httpCode ?? candidate.statusCode;
	const status = Number(value);
	return Number.isFinite(status) ? status : 0;
};

/** Converts any transport or API failure into an n8n error with a useful hint. */
export function toNodeApiError(node: INode, error: unknown, itemIndex?: number): NodeApiError {
	const status = statusOf(error);
	const body = bodyOf(error);
	const detail =
		(typeof body.detail === 'string' && body.detail) ||
		(typeof body.title === 'string' && body.title) ||
		(typeof body.message === 'string' && body.message) ||
		(error instanceof Error ? error.message : 'Verifycate request failed.');

	return new NodeApiError(node, error as JsonObject, {
		message: String(detail),
		description: HINTS[status],
		httpCode: status > 0 ? String(status) : undefined,
		...(itemIndex === undefined ? {} : { itemIndex }),
	});
}

export function operationError(
	node: INode,
	message: string,
	description?: string,
	itemIndex?: number,
): NodeOperationError {
	return new NodeOperationError(node, message, {
		description,
		...(itemIndex === undefined ? {} : { itemIndex }),
	});
}
