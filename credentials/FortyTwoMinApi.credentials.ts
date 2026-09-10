import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class FortyTwoMinApi implements ICredentialType {
	name = 'fortyTwoMinApi';

	displayName = '42min API';

	icon: Icon = { light: 'file:../icons/fortytwomin.svg', dark: 'file:../icons/fortytwomin.dark.svg' };

	documentationUrl = 'https://42min.us/help/api';

	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Personal access token from 42min. Create one under Settings &gt; API in your 42min account.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.42min.us',
			description:
				'Change this only if you run a self-hosted 42min instance. Do not include a trailing slash or the /v1 path.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.accessToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/me',
		},
	};
}
