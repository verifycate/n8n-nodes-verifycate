import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import { operationError } from '../../shared/errors';
import {
	applyOutput,
	withVerificationUrl,
	type OutputMode,
	type VerifycateResource,
} from '../../shared/output';
import { fetchAllPages, verifycateApiRequest } from '../../shared/transport';

type OperationResult = {
	data: IDataObject | IDataObject[];
	resource: VerifycateResource;
};

type IssueList = { items?: IDataObject[] | null; total?: number };

const SLUG = 'current';

const stringParam = (ctx: IExecuteFunctions, name: string, i: number, fallback = ''): string =>
	String(ctx.getNodeParameter(name, i, fallback) ?? fallback);

const locatorValue = (ctx: IExecuteFunctions, name: string, i: number): string =>
	String(ctx.getNodeParameter(name, i, '', { extractValue: true }) ?? '').trim();

const collection = (ctx: IExecuteFunctions, name: string, i: number): IDataObject =>
	(ctx.getNodeParameter(name, i, {}) as IDataObject) ?? {};

const attributesFor = (ctx: IExecuteFunctions, i: number): IDataObject => {
	const mapper = ctx.getNodeParameter('attributes', i, {}) as { value?: IDataObject | null };
	return mapper?.value ?? {};
};

const parseJsonArray = (ctx: IExecuteFunctions, value: unknown, field: string, i: number) => {
	if (value === undefined || value === null || value === '') return undefined;
	let parsed: unknown;
	try {
		parsed = typeof value === 'string' ? JSON.parse(value) : value;
	} catch {
		throw operationError(
			ctx.getNode(),
			`The '${field}' field must be valid JSON.`,
			'Provide a JSON array, for example [{"key":"score","label":"Score"}].',
			i,
		);
	}
	if (!Array.isArray(parsed)) {
		throw operationError(
			ctx.getNode(),
			`The '${field}' field must be a JSON array.`,
			'Provide a JSON array, for example [{"key":"score","label":"Score"}].',
			i,
		);
	}
	return parsed;
};

const copyFields = (
	source: IDataObject,
	target: IDataObject,
	keys: readonly string[],
	options: { keepEmptyString?: boolean; keepZero?: boolean } = {},
) => {
	for (const key of keys) {
		if (!(key in source)) continue;
		const value = source[key];
		if (value === undefined || value === null) continue;
		if (!options.keepEmptyString && value === '') continue;
		if (!options.keepZero && value === 0) continue;
		target[key] = value;
	}
};

const findIssueByEmail = async (
	ctx: IExecuteFunctions,
	certificateId: string,
	email: string,
	i: number,
): Promise<IDataObject> => {
	const page = await verifycateApiRequest<IssueList>(
		ctx,
		'listIssues',
		{ slug: SLUG, id: certificateId },
		{ qs: { search: email, limit: 25, offset: 0 } },
	);
	const normalized = email.trim().toLowerCase();
	const issue = (page.items ?? []).find(
		(candidate: IDataObject) =>
			String(candidate.recipient_email ?? '')
				.trim()
				.toLowerCase() === normalized,
	);

	if (!issue) {
		throw operationError(
			ctx.getNode(),
			`No certificate was found for ${email} in the selected certificate.`,
			'Check the recipient email and certificate. The recipient must already be enrolled before this action can run.',
			i,
		);
	}
	return issue;
};

const issueById = async (ctx: IExecuteFunctions, issueId: string): Promise<IDataObject> =>
	verifycateApiRequest<IDataObject>(ctx, 'getIssue', { slug: SLUG, issueID: issueId });

const outputMode = (ctx: IExecuteFunctions, i: number): OutputMode =>
	(stringParam(ctx, 'output', i, 'simplified') || 'simplified') as OutputMode;

const selectedFields = (ctx: IExecuteFunctions, i: number): string[] =>
	(ctx.getNodeParameter('selectedFields', i, []) as string[]) ?? [];

export const applyResult = (
	ctx: IExecuteFunctions,
	result: OperationResult,
	i: number,
): IDataObject[] => {
	const mode = outputMode(ctx, i);
	const fields = selectedFields(ctx, i);
	const applied = applyOutput(result.data, result.resource, mode, fields);
	return Array.isArray(applied) ? applied : [applied];
};

// ── Certificate ──────────────────────────────────────────────────────────────

const runCertificate = async (
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<OperationResult> => {
	if (operation === 'getMany') {
		const filters = collection(ctx, 'filters', i);
		const qs: IDataObject = { ...filters };
		const returnAll = ctx.getNodeParameter('returnAll', i, false) as boolean;
		const data: IDataObject[] = returnAll
			? await fetchAllPages<IDataObject>(ctx, 'listCertificates', { slug: SLUG }, qs)
			: ((
					await verifycateApiRequest<IssueList>(
						ctx,
						'listCertificates',
						{ slug: SLUG },
						{
							qs: {
								...qs,
								limit: Math.min(Math.max(Number(ctx.getNodeParameter('limit', i, 50)), 1), 200),
							},
						},
					)
				).items ?? []);
		return { data, resource: 'certificate' };
	}

	if (operation === 'create') {
		const body: IDataObject = { name: stringParam(ctx, 'name', i).trim() };
		const fields = collection(ctx, 'additionalFields', i);
		copyFields(fields, body, [
			'certificate_type',
			'description',
			'duration',
			'level',
			'learn_more_url',
			'status',
			'design_mode',
			'request_form_mode',
			'correction_form_mode',
		]);
		copyFields(fields, body, ['request_form_enabled', 'correction_form_enabled'], {
			keepEmptyString: true,
		});
		if (typeof fields.validity_days === 'number' && fields.validity_days > 0) {
			body.validity_days = fields.validity_days;
		}
		if ('attributes' in fields) {
			const attributes = parseJsonArray(ctx, fields.attributes, 'Attributes', i);
			if (attributes) body.attributes = attributes;
		}

		const data = await verifycateApiRequest<IDataObject>(
			ctx,
			'createCertificate',
			{ slug: SLUG },
			{ body },
		);
		return { data, resource: 'certificate' };
	}

	const certificateId = locatorValue(ctx, 'certificateId', i);

	if (operation === 'get') {
		const data = await verifycateApiRequest<IDataObject>(ctx, 'getCertificate', {
			slug: SLUG,
			id: certificateId,
		});
		return { data, resource: 'certificate' };
	}

	if (operation === 'update') {
		const body: IDataObject = {};
		const fields = collection(ctx, 'updateFields', i);
		copyFields(fields, body, [
			'certificate_type',
			'description',
			'duration',
			'level',
			'learn_more_url',
			'name',
			'status',
			'request_form_mode',
			'correction_form_mode',
		]);
		copyFields(fields, body, ['request_form_enabled', 'correction_form_enabled'], {
			keepEmptyString: true,
		});
		if (typeof fields.validity_days === 'number' && fields.validity_days > 0) {
			body.validity_days = fields.validity_days;
		}
		if ('attributes' in fields) {
			const attributes = parseJsonArray(ctx, fields.attributes, 'Attributes', i);
			if (attributes) body.attributes = attributes;
		}
		if (Object.keys(body).length === 0) {
			throw operationError(
				ctx.getNode(),
				'No certificate fields were provided.',
				'Add at least one field to update.',
				i,
			);
		}
		const data = await verifycateApiRequest<IDataObject>(
			ctx,
			'updateCertificate',
			{ slug: SLUG, id: certificateId },
			{ body },
		);
		return { data, resource: 'certificate' };
	}

	if (operation === 'delete') {
		await verifycateApiRequest(ctx, 'deleteCertificate', { slug: SLUG, id: certificateId });
		return { data: { id: certificateId, deleted: true }, resource: 'certificate' };
	}

	throw operationError(
		ctx.getNode(),
		`Unsupported certificate operation: ${operation}`,
		undefined,
		i,
	);
};

// ── Certificate Issue ────────────────────────────────────────────────────────

const runCertificateIssue = async (
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<OperationResult> => {
	const certificateId = locatorValue(ctx, 'certificateId', i);

	if (operation === 'addRecipient') {
		const email = stringParam(ctx, 'email', i).trim();
		const issue: IDataObject = {
			email,
			name: stringParam(ctx, 'name', i).trim(),
			attributes: attributesFor(ctx, i),
		};
		const expiresAt = stringParam(ctx, 'expiresAt', i);
		if (expiresAt) issue.expires_at = expiresAt;
		const body: IDataObject = {
			issues: [
				Object.fromEntries(
					Object.entries(issue).filter(([, value]) => value !== '' && value !== undefined),
				),
			],
		};

		const result = await verifycateApiRequest<IDataObject>(
			ctx,
			'importIssues',
			{ slug: SLUG, id: certificateId },
			{ body },
		);
		const first = (result.items as IDataObject[] | undefined)?.[0];
		if (first) {
			return {
				data: { ...withVerificationUrl(first), already_enrolled: false },
				resource: 'certificateIssue',
			};
		}

		const verdict = (result.results as IDataObject[] | undefined)?.[0];
		const rejected = (result.rejected as string[] | undefined) ?? [];
		const isDuplicate =
			verdict?.verdict === 'duplicate' ||
			rejected.some((value) => value.toLowerCase() === email.toLowerCase());

		if (isDuplicate) {
			const existing = await findIssueByEmail(ctx, certificateId, email, i);
			if (existing) {
				return {
					data: { ...withVerificationUrl(existing), already_enrolled: true },
					resource: 'certificateIssue',
				};
			}
		}

		if (verdict?.verdict === 'invalid') {
			const reasons = ((verdict.issues as IDataObject[] | undefined) ?? [])
				.map((issue) => {
					if (typeof issue === 'string') return issue;
					return String(issue.message ?? issue.code ?? '');
				})
				.filter(Boolean);
			throw operationError(
				ctx.getNode(),
				reasons.length > 0
					? `Verifycate rejected this recipient: ${reasons.join('; ')}.`
					: 'Verifycate rejected this recipient.',
				'Check the email address and certificate settings, then try again.',
				i,
			);
		}

		throw operationError(
			ctx.getNode(),
			'Verifycate did not create a recipient for this row.',
			'Check the certificate status and try again.',
			i,
		);
	}

	if (operation === 'getMany') {
		const filters = collection(ctx, 'filters', i);
		const qs: IDataObject = { ...filters };
		const returnAll = ctx.getNodeParameter('returnAll', i, false) as boolean;
		const data: IDataObject[] = returnAll
			? await fetchAllPages<IDataObject>(ctx, 'listIssues', { slug: SLUG, id: certificateId }, qs)
			: ((
					await verifycateApiRequest<IssueList>(
						ctx,
						'listIssues',
						{ slug: SLUG, id: certificateId },
						{
							qs: {
								...qs,
								limit: Math.min(Math.max(Number(ctx.getNodeParameter('limit', i, 50)), 1), 200),
							},
						},
					)
				).items ?? []);
		return {
			data: data.map((issue) => withVerificationUrl(issue)),
			resource: 'certificateIssue',
		};
	}

	const email = stringParam(ctx, 'email', i).trim();
	const issue = await findIssueByEmail(ctx, certificateId, email, i);
	const issueId = String(issue.id);

	if (operation === 'get') {
		const data = await issueById(ctx, issueId);
		return { data: withVerificationUrl(data), resource: 'certificateIssue' };
	}

	if (operation === 'issue') {
		const data = await verifycateApiRequest<IDataObject>(ctx, 'issueCertificate', {
			slug: SLUG,
			issueID: issueId,
		});
		return { data: withVerificationUrl(data), resource: 'certificateIssue' };
	}

	if (operation === 'update') {
		const body: IDataObject = {};
		const newEmail = stringParam(ctx, 'newEmail', i).trim();
		const newName = stringParam(ctx, 'newName', i).trim();
		const newExpiresAt = stringParam(ctx, 'newExpiresAt', i);
		const attributes = attributesFor(ctx, i);
		if (newEmail) body.email = newEmail;
		if (newName) body.name = newName;
		if (newExpiresAt) body.expires_at = newExpiresAt;
		if (Object.keys(attributes).length > 0) body.attributes = attributes;

		if (Object.keys(body).length === 0) {
			throw operationError(
				ctx.getNode(),
				'No recipient fields were provided.',
				'Set a new email, name, expiry, or attribute value.',
				i,
			);
		}
		const data = await verifycateApiRequest<IDataObject>(
			ctx,
			'updateIssue',
			{ slug: SLUG, issueID: issueId },
			{ body },
		);
		return { data: withVerificationUrl(data), resource: 'certificateIssue' };
	}

	if (operation === 'revoke') {
		const reason = stringParam(ctx, 'reason', i).trim();
		if (reason.length < 3) {
			throw operationError(
				ctx.getNode(),
				'The revocation reason must be at least 3 characters.',
				'Add a short audit note explaining why the certificate is being revoked.',
				i,
			);
		}
		if (issue.status === 'revoked') {
			throw operationError(
				ctx.getNode(),
				`The certificate for ${email} is already revoked.`,
				'Use Replace to issue a fresh certificate to this recipient.',
				i,
			);
		}
		if (issue.status === 'pending') {
			throw operationError(
				ctx.getNode(),
				`The certificate for ${email} has not been issued yet, so it cannot be revoked.`,
				'Issue the certificate first, then revoke it if needed.',
				i,
			);
		}
		const body: IDataObject = { reason };
		const publicNote = stringParam(ctx, 'publicNote', i).trim();
		if (publicNote) body.public_note = publicNote;
		const data = await verifycateApiRequest<IDataObject>(
			ctx,
			'revokeIssue',
			{ slug: SLUG, issueID: issueId },
			{ body },
		);
		return { data: withVerificationUrl(data), resource: 'certificateIssue' };
	}

	if (operation === 'replace') {
		if (issue.status !== 'revoked') {
			throw operationError(
				ctx.getNode(),
				`Only a revoked certificate can be replaced. The certificate for ${email} is ${String(issue.status)}.`,
				'Revoke the certificate first, then replace it.',
				i,
			);
		}
		const data = await verifycateApiRequest<IDataObject>(ctx, 'replaceIssue', {
			slug: SLUG,
			issueID: issueId,
		});
		return {
			data: { ...withVerificationUrl(data), replaced_issue_id: issueId },
			resource: 'certificateIssue',
		};
	}

	if (operation === 'reissue') {
		if (issue.status === 'pending') {
			throw operationError(
				ctx.getNode(),
				`The certificate for ${email} has not been issued yet.`,
				'Issue the certificate before reissuing it onto a new design.',
				i,
			);
		}
		if (issue.status === 'revoked') {
			throw operationError(
				ctx.getNode(),
				`The certificate for ${email} is revoked.`,
				'Use Replace to issue a fresh certificate after a revocation.',
				i,
			);
		}
		const data = await verifycateApiRequest<IDataObject>(ctx, 'reissueCertificate', {
			slug: SLUG,
			issueID: issueId,
		});
		return { data: withVerificationUrl(data), resource: 'certificateIssue' };
	}

	if (operation === 'remind') {
		if (issue.status === 'revoked') {
			throw operationError(
				ctx.getNode(),
				`The certificate for ${email} is revoked and cannot be sent again.`,
				'Use Replace to issue a fresh certificate.',
				i,
			);
		}
		await verifycateApiRequest(ctx, 'remindIssue', { slug: SLUG, issueID: issueId });
		return {
			data: { issue_id: issueId, recipient_email: email, sent: true },
			resource: 'certificateIssue',
		};
	}

	if (operation === 'delete') {
		await verifycateApiRequest(ctx, 'deleteIssue', { slug: SLUG, issueID: issueId });
		return { data: { id: issueId, deleted: true }, resource: 'certificateIssue' };
	}

	throw operationError(
		ctx.getNode(),
		`Unsupported certificate issue operation: ${operation}`,
		undefined,
		i,
	);
};

// ── Recipient ────────────────────────────────────────────────────────────────

const runRecipient = async (
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<OperationResult> => {
	if (operation === 'get') {
		const email = stringParam(ctx, 'email', i).trim();
		const data = await verifycateApiRequest<IDataObject>(ctx, 'getRecipient', {
			slug: SLUG,
			email,
		});
		return { data, resource: 'recipient' };
	}

	const filters = collection(ctx, 'filters', i);
	const qs: IDataObject = { ...filters };
	const returnAll = ctx.getNodeParameter('returnAll', i, false) as boolean;
	const data: IDataObject[] = returnAll
		? await fetchAllPages<IDataObject>(ctx, 'listRecipients', { slug: SLUG }, qs)
		: ((
				await verifycateApiRequest<IssueList>(
					ctx,
					'listRecipients',
					{ slug: SLUG },
					{
						qs: {
							...qs,
							limit: Math.min(Math.max(Number(ctx.getNodeParameter('limit', i, 50)), 1), 200),
						},
					},
				)
			).items ?? []);
	return { data, resource: 'recipient' };
};

// ── Requests and corrections ─────────────────────────────────────────────────

const reviewOperation = async (
	ctx: IExecuteFunctions,
	resource: 'request' | 'correction',
	operation: string,
	i: number,
): Promise<OperationResult> => {
	if (operation === 'getMany') {
		const filters = collection(ctx, 'filters', i);
		const qs: IDataObject = { ...filters };
		const returnAll = ctx.getNodeParameter('returnAll', i, false) as boolean;
		const listOperation = resource === 'request' ? 'listRequests' : 'listCorrections';
		const data: IDataObject[] = returnAll
			? await fetchAllPages<IDataObject>(ctx, listOperation, { slug: SLUG }, qs)
			: ((
					await verifycateApiRequest<IssueList>(
						ctx,
						listOperation,
						{ slug: SLUG },
						{
							qs: {
								...qs,
								limit: Math.min(Math.max(Number(ctx.getNodeParameter('limit', i, 50)), 1), 200),
							},
						},
					)
				).items ?? []);
		return { data, resource };
	}

	const id = stringParam(ctx, resource === 'request' ? 'requestId' : 'correctionId', i).trim();
	const reason = stringParam(ctx, 'reason', i).trim();
	const body: IDataObject = reason ? { reason } : {};
	const operationName =
		resource === 'request'
			? operation === 'approve'
				? 'approveRequest'
				: operation === 'reject'
					? 'rejectRequest'
					: 'reopenRequest'
			: operation === 'approve'
				? 'approveCorrection'
				: operation === 'reject'
					? 'rejectCorrection'
					: 'reopenCorrection';

	const data = await verifycateApiRequest<IDataObject>(
		ctx,
		operationName,
		{ slug: SLUG, id },
		{ body },
	);

	if (operation === 'approve') {
		return { data: withVerificationUrl(data), resource: 'certificateIssue' };
	}
	return { data, resource };
};

// ── Dispatch ─────────────────────────────────────────────────────────────────

export async function runVerifycateOperation(
	ctx: IExecuteFunctions,
	i: number,
): Promise<IDataObject[]> {
	const resource = stringParam(ctx, 'resource', i);
	const operation = stringParam(ctx, 'operation', i);

	let result: OperationResult;
	switch (resource) {
		case 'certificate':
			result = await runCertificate(ctx, operation, i);
			break;
		case 'certificateIssue':
			result = await runCertificateIssue(ctx, operation, i);
			break;
		case 'recipient':
			result = await runRecipient(ctx, operation, i);
			break;
		case 'request':
			result = await reviewOperation(ctx, 'request', operation, i);
			break;
		case 'correction':
			result = await reviewOperation(ctx, 'correction', operation, i);
			break;
		default:
			throw operationError(ctx.getNode(), `Unsupported resource: ${resource}`, undefined, i);
	}

	return applyResult(ctx, result, i);
}
