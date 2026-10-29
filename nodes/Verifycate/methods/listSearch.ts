import type { IDataObject, ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

import { verifycateApiRequest } from '../../../shared/transport';

type CertificatePage = {
	items?: IDataObject[] | null;
	total?: number;
};

/**
 * Populates the Certificate resource locator. n8n calls this with the text the
 * user typed and the pagination token returned by the previous page.
 */
export async function searchCertificates(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const offset = paginationToken ? Number(paginationToken) : 0;
	const limit = 100;

	const page = await verifycateApiRequest<CertificatePage>(
		this,
		'listCertificates',
		{ slug: 'current' },
		{
			qs: {
				...(filter ? { search: filter } : {}),
				limit,
				offset,
			},
		},
	);

	const results = (page.items ?? []).map((certificate) => ({
		name: String(certificate.name ?? certificate.id),
		value: String(certificate.id),
	}));

	const total = Number(page.total ?? 0);
	const next = offset + results.length;

	return {
		results,
		...(next < total ? { paginationToken: String(next) } : {}),
	};
}
