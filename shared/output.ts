import type { IDataObject } from 'n8n-workflow';

import { PORTAL_BASE_URL } from './constants';

export type OutputMode = 'simplified' | 'raw' | 'selected';

export type VerifycateResource =
	| 'certificate'
	| 'certificateIssue'
	| 'recipient'
	| 'request'
	| 'correction';

const ACRONYMS = new Set(['id', 'url', 'api', 'uuid']);

const humanize = (key: string): string =>
	key
		.split('_')
		.map((word) =>
			ACRONYMS.has(word.toLowerCase())
				? word.toUpperCase()
				: word.charAt(0).toUpperCase() + word.slice(1),
		)
		.join(' ');

const optionsFor = (keys: readonly string[]) =>
	keys.map((key) => ({ name: humanize(key), value: key }));

const CERTIFICATE_FIELDS = [
	'id',
	'name',
	'status',
	'certificate_type',
	'description',
	'validity_days',
	'design_count',
	'badge_count',
	'created_at',
	'updated_at',
	'attributes',
] as const;

const ISSUE_FIELDS = [
	'id',
	'certificate_id',
	'recipient_email',
	'recipient_name',
	'status',
	'public_id',
	'issued_at',
	'expires_at',
	'revoked_at',
	'public_revocation_note',
	'pending_reason',
	'design_version',
	'notified_at',
	'created_at',
	'updated_at',
	'attributes',
	'verification_url',
	'already_enrolled',
	'replaced_issue_id',
] as const;

const RECIPIENT_FIELDS = [
	'recipient_email',
	'recipient_name',
	'recipient_status',
	'issue_count',
	'certificate_count',
	'latest_issued_at',
	'latest_created_at',
	'last_engaged_at',
	'issues',
] as const;

const REQUEST_FIELDS = [
	'id',
	'certificate_id',
	'certificate_name',
	'status',
	'submitted_at',
	'created_at',
	'rejection_reason',
	'fields',
	'form_fields',
] as const;

const CORRECTION_FIELDS = [
	'id',
	'certificate_id',
	'certificate_name',
	'certificate_issue_id',
	'issue_public_id',
	'status',
	'recipient_name',
	'recipient_email',
	'created_at',
	'updated_at',
	'rejection_reason',
	'requested_changes',
	'fields',
	'form_fields',
	'issue_attributes',
] as const;

/** Curated fields used by the Simplified output mode. Keep each list under 10. */
export const SIMPLIFIED_FIELDS: Record<VerifycateResource, readonly string[]> = {
	certificate: [
		'id',
		'name',
		'status',
		'certificate_type',
		'description',
		'validity_days',
		'design_count',
		'created_at',
		'updated_at',
	],
	certificateIssue: [
		'id',
		'certificate_id',
		'recipient_email',
		'recipient_name',
		'status',
		'public_id',
		'issued_at',
		'expires_at',
		'revoked_at',
		'verification_url',
		'already_enrolled',
	],
	recipient: [
		'recipient_email',
		'recipient_name',
		'recipient_status',
		'issue_count',
		'certificate_count',
		'latest_issued_at',
		'latest_created_at',
	],
	request: ['id', 'certificate_name', 'status', 'submitted_at', 'created_at', 'fields'],
	correction: [
		'id',
		'certificate_name',
		'status',
		'recipient_name',
		'recipient_email',
		'created_at',
		'updated_at',
	],
};

export const OUTPUT_FIELD_OPTIONS: Record<VerifycateResource, { name: string; value: string }[]> = {
	certificate: optionsFor(CERTIFICATE_FIELDS),
	certificateIssue: optionsFor(ISSUE_FIELDS),
	recipient: optionsFor(RECIPIENT_FIELDS),
	request: optionsFor(REQUEST_FIELDS),
	correction: optionsFor(CORRECTION_FIELDS),
};

export const verificationUrl = (issue: IDataObject | undefined): string | undefined => {
	if (!issue) return undefined;
	const publicUrl = issue.public_url;
	if (typeof publicUrl === 'string' && publicUrl !== '') return publicUrl;
	const publicId = issue.public_id;
	if (typeof publicId === 'string' && publicId !== '') return `${PORTAL_BASE_URL}/c/${publicId}`;
	return undefined;
};

/** Adds the public verification link to an issue-shaped payload. */
export const withVerificationUrl = <T extends IDataObject>(issue: T): T & IDataObject => {
	const url = verificationUrl(issue);
	return url ? { ...issue, verification_url: url } : { ...issue };
};

const pick = (data: IDataObject, keys: readonly string[]): IDataObject => {
	const out: IDataObject = {};
	for (const key of keys) {
		if (data[key] !== undefined) out[key] = data[key];
	}
	return out;
};

const applyToItem = (
	item: IDataObject,
	resource: VerifycateResource,
	mode: OutputMode,
	selected: readonly string[],
): IDataObject => {
	if (mode === 'raw') return item;
	if (mode === 'selected') {
		const keys = selected.length > 0 ? selected : SIMPLIFIED_FIELDS[resource];
		return pick(item, keys);
	}
	return pick(item, SIMPLIFIED_FIELDS[resource]);
};

/**
 * Applies the node's output mode to one record or a page of records. Delete
 * confirmations pass through unchanged because they are already minimal.
 */
export function applyOutput<T extends IDataObject | IDataObject[]>(
	data: T,
	resource: VerifycateResource,
	mode: OutputMode,
	selected: readonly string[] = [],
): T {
	if (Array.isArray(data)) {
		return data.map((item) => applyToItem(item, resource, mode, selected)) as T;
	}

	const item = data as IDataObject;
	if (item.deleted === true || item.sent === true) return data;
	return applyToItem(item, resource, mode, selected) as T;
}
