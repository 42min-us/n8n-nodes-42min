import type { INodeProperties } from 'n8n-workflow';
import { cursorPagination, unwrap } from '../Routing';

export const eventTypeOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['eventType'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get an event type',
				description: 'Retrieve a single event type by ID or slug',
				routing: {
					request: {
						method: 'GET',
						// username/event_slug is one path segment, so the slash is encoded.
						url: '=/event-types/{{ $parameter.identifyBy === "usernameSlug" ? encodeURIComponent($parameter.username + "/" + $parameter.eventSlug) : $parameter.eventTypeId }}',
					},
					output: { postReceive: [unwrap] },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many event types',
				description: 'Retrieve a list of event types',
				routing: {
					request: { method: 'GET', url: '/event-types' },
					operations: cursorPagination,
					output: { postReceive: [unwrap] },
				},
			},
		],
		default: 'getAll',
	},
];

export const eventTypeFields: INodeProperties[] = [
	{
		displayName: 'Identify Event Type By',
		name: 'identifyBy',
		type: 'options',
		default: 'eventTypeId',
		displayOptions: { show: { resource: ['eventType'], operation: ['get'] } },
		options: [
			{ name: 'Event Type ID', value: 'eventTypeId' },
			{ name: 'Username and Slug', value: 'usernameSlug' },
		],
		description:
			'A slug on its own is not enough: it is unique per user, not per account, so it needs the username alongside it',
	},
	{
		displayName: 'Event Type ID',
		name: 'eventTypeId',
		type: 'string',
		required: true,
		default: '',
		placeholder: '434bc884-1908-4fc4-af5c-e362dcab5690',
		displayOptions: {
			show: { resource: ['eventType'], operation: ['get'], identifyBy: ['eventTypeId'] },
		},
	},
	{
		displayName: 'Username',
		name: 'username',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['eventType'], operation: ['get'], identifyBy: ['usernameSlug'] },
		},
		description: 'The host\'s 42min username, the part after the slash in their booking link',
	},
	{
		displayName: 'Event Slug',
		name: 'eventSlug',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['eventType'], operation: ['get'], identifyBy: ['usernameSlug'] },
		},
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: { show: { resource: ['eventType'], operation: ['getAll'] } },
		description: 'Whether to return all results or only up to a given limit',
		routing: { send: { paginate: '={{ $value }}' } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1 },
		displayOptions: {
			show: { resource: ['eventType'], operation: ['getAll'], returnAll: [false] },
		},
		description: 'Max number of results to return',
		routing: { send: { type: 'query', property: 'limit' } },
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['eventType'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'Active',
				name: 'active',
				type: 'boolean',
				default: true,
				description: 'Whether to return only event types that accept bookings',
				routing: {
					send: { type: 'query', property: 'active', value: '={{ $value ? "true" : "false" }}' },
				},
			},
			{
				displayName: 'Slug',
				name: 'slug',
				type: 'string',
				default: '',
				routing: { send: { type: 'query', property: 'slug' } },
			},
			{
				displayName: 'User ID',
				name: 'user_id',
				type: 'string',
				default: '',
				description: 'Only event types hosted by this user',
				routing: { send: { type: 'query', property: 'user_id' } },
			},
		],
	},
];
