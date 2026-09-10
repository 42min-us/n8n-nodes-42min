import type { INodeProperties } from 'n8n-workflow';
import { unwrap } from '../Routing';

export const userOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['user'] } },
		options: [
			{
				name: 'Get Current',
				value: 'getCurrent',
				action: 'Get the current user',
				description: 'Return the profile the token authenticates, plus its 42min account',
				routing: {
					request: { method: 'GET', url: '/me' },
					output: { postReceive: [unwrap] },
				},
			},
		],
		default: 'getCurrent',
	},
];

export const userFields: INodeProperties[] = [];
