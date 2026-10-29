import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class VerifycateApi implements ICredentialType {
	name = 'verifycateApi';

	displayName = 'Verifycate API';

	icon: Icon = { light: 'file:../icons/verifycate.svg', dark: 'file:../icons/verifycate.dark.svg' };

	documentationUrl = 'https://developers.verifycate.com/docs/api/authentication';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Workspace API key from Verifycate under Workspace → API Keys. The key starts with vc_.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.verifycate.com',
			required: true,
			description:
				'Base URL of the Verifycate API. Only change this when connecting to a staging environment.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
				Accept: 'application/json',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/v1/workspaces/current',
			method: 'GET',
		},
	};
}
