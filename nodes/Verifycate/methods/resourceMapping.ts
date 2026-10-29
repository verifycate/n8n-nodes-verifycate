import type { ILoadOptionsFunctions, ResourceMapperFields } from 'n8n-workflow';

import { verifycateApiRequest } from '../../../shared/transport';

type Certificate = {
	attributes?: Array<{ key?: string; label?: string }> | null;
};

/**
 * Loads the selected certificate's attribute definitions into the resource
 * mapper. Attributes are defined per certificate, so a static field list would
 * force users to hand-write JSON.
 */
export async function getCertificateAttributes(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	const certificateId = String(
		this.getNodeParameter('certificateId', '', { extractValue: true }) ?? '',
	).trim();

	if (!certificateId) {
		return {
			fields: [],
			emptyFieldsNotice: 'Select a certificate to load its attributes.',
		};
	}

	const certificate = await verifycateApiRequest<Certificate>(this, 'getCertificate', {
		slug: 'current',
		id: certificateId,
	});

	const fields = (certificate.attributes ?? [])
		.filter((attribute) => typeof attribute.key === 'string' && attribute.key !== '')
		.map((attribute) => ({
			id: String(attribute.key),
			displayName: String(attribute.label ?? attribute.key),
			required: false,
			defaultMatch: false,
			display: true,
			type: 'string' as const,
			canBeUsedToMatch: false,
		}));

	return {
		fields,
		...(fields.length === 0
			? { emptyFieldsNotice: 'This certificate has no attributes defined.' }
			: {}),
	};
}
