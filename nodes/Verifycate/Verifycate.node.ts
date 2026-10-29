import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type IExecuteFunctions,
	type JsonObject,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

import { verifycateProperties } from './descriptions';
import { searchCertificates } from './methods/listSearch';
import { getCertificateAttributes } from './methods/resourceMapping';
import { runVerifycateOperation } from './operations';

export class Verifycate implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Verifycate',
		name: 'verifycate',
		icon: {
			light: 'file:../../icons/verifycate.svg',
			dark: 'file:../../icons/verifycate.dark.svg',
		},
		group: ['input'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Issue, revoke, replace, and track certificates',
		defaults: {
			name: 'Verifycate',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'verifycateApi',
				required: true,
			},
		],
		properties: verifycateProperties,
	};

	methods = {
		listSearch: {
			searchCertificates,
		},
		resourceMapping: {
			getCertificateAttributes,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const rows = await runVerifycateOperation(this, i);
				for (const row of rows) {
					returnData.push({
						json: row,
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}

				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject, {
						itemIndex: i,
					});
				}

				if (error instanceof NodeOperationError) {
					throw new NodeOperationError(this.getNode(), error.message, { itemIndex: i });
				}

				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
