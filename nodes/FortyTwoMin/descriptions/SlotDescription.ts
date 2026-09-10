import type { INodeProperties } from 'n8n-workflow';
import { unwrap } from '../Routing';

export const slotOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['slot'] } },
		options: [
			{
				name: 'Check',
				value: 'check',
				action: 'Check a slot',
				description: 'Check whether one specific start time is bookable',
				routing: {
					request: { method: 'GET', url: '/slots/check' },
					output: { postReceive: [unwrap] },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many slots',
				description: 'List bookable slots for an event type over a date range',
				routing: {
					request: { method: 'GET', url: '/slots' },
					output: { postReceive: [unwrap] },
				},
			},
		],
		default: 'getAll',
	},
];

const identify: INodeProperties[] = [
	{
		displayName: 'Identify Event Type By',
		name: 'identifyBy',
		type: 'options',
		default: 'eventTypeId',
		displayOptions: { show: { resource: ['slot'] } },
		options: [
			{ name: 'Event Type ID', value: 'eventTypeId' },
			{ name: 'Username and Slug', value: 'usernameSlug' },
		],
	},
	{
		displayName: 'Event Type ID',
		name: 'eventTypeId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['slot'], identifyBy: ['eventTypeId'] } },
		routing: { send: { type: 'query', property: 'event_type_id' } },
	},
	{
		displayName: 'Username',
		name: 'username',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['slot'], identifyBy: ['usernameSlug'] } },
		routing: { send: { type: 'query', property: 'username' } },
	},
	{
		displayName: 'Event Slug',
		name: 'eventSlug',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['slot'], identifyBy: ['usernameSlug'] } },
		routing: { send: { type: 'query', property: 'event_slug' } },
	},
];

export const slotFields: INodeProperties[] = [
	...identify,
	{
		displayName: 'Start',
		name: 'start',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['slot'] } },
		description: 'Start of the range for Get Many, or the exact start time for Check',
		routing: { send: { type: 'query', property: 'start' } },
	},
	{
		displayName: 'End',
		name: 'end',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['slot'], operation: ['getAll'] } },
		description: 'End of the range. A very wide range is capped, and the response says so with "truncated".',
		routing: { send: { type: 'query', property: 'end' } },
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['slot'] } },
		options: [
			{
				displayName: 'End',
				name: 'end',
				type: 'dateTime',
				default: '',
				description: 'Only for Check. Defaults to the start plus the event type\'s duration.',
				routing: { send: { type: 'query', property: 'end' } },
			},
			{
				displayName: 'Timezone',
				name: 'timezone',
				type: 'string',
				default: '',
				placeholder: 'Europe/Lisbon',
				description: 'IANA timezone the slots are computed for',
				routing: { send: { type: 'query', property: 'timezone' } },
			},
		],
	},
];
