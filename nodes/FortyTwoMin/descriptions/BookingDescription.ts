import type { INodeProperties } from 'n8n-workflow';
import { addIdempotencyKey, addIfMatch, cursorPagination, unwrap } from '../Routing';

export const bookingOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['booking'] } },
		options: [
			{
				name: 'Cancel',
				value: 'cancel',
				action: 'Cancel a booking',
				description: 'Cancel a booking and notify the attendee',
				routing: {
					request: { method: 'POST', url: '=/bookings/{{$parameter.uid}}/cancel' },
					send: { preSend: [addIdempotencyKey] },
					output: { postReceive: [unwrap] },
				},
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a booking',
				description: 'Book a time on an event type. Sends real email and writes to a real calendar.',
				routing: {
					request: { method: 'POST', url: '/bookings' },
					send: { preSend: [addIdempotencyKey] },
					output: { postReceive: [unwrap] },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a booking',
				description: 'Retrieve a single booking, including invitee form answers',
				routing: {
					request: { method: 'GET', url: '=/bookings/{{$parameter.uid}}' },
					output: { postReceive: [unwrap] },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many bookings',
				description: 'Retrieve a list of bookings',
				routing: {
					request: { method: 'GET', url: '/bookings' },
					operations: cursorPagination,
					output: { postReceive: [unwrap] },
				},
			},
			{
				name: 'Reschedule',
				value: 'reschedule',
				action: 'Reschedule a booking',
				description: 'Move a booking to a new time and notify the attendee',
				routing: {
					request: { method: 'POST', url: '=/bookings/{{$parameter.uid}}/reschedule' },
					send: { preSend: [addIdempotencyKey] },
					output: { postReceive: [unwrap] },
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a booking',
				description: 'Update metadata, form answers or the attendee name',
				routing: {
					request: { method: 'PATCH', url: '=/bookings/{{$parameter.uid}}' },
					send: { preSend: [addIdempotencyKey, addIfMatch] },
					output: { postReceive: [unwrap] },
				},
			},
		],
		default: 'getAll',
	},
];

const uidField: INodeProperties = {
	displayName: 'Booking UID',
	name: 'uid',
	type: 'string',
	required: true,
	default: '',
	displayOptions: {
		show: { resource: ['booking'], operation: ['get', 'update', 'cancel', 'reschedule'] },
	},
	description: 'The booking UID, as returned by Get Many or carried on a trigger item',
};

export const bookingFields: INodeProperties[] = [
	uidField,

	// ---------------------------------------------------------------- create
	{
		displayName: 'Identify Event Type By',
		name: 'identifyBy',
		type: 'options',
		default: 'eventTypeId',
		displayOptions: { show: { resource: ['booking'], operation: ['create'] } },
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
		displayOptions: {
			show: { resource: ['booking'], operation: ['create'], identifyBy: ['eventTypeId'] },
		},
		routing: { send: { type: 'body', property: 'event_type_id' } },
	},
	{
		displayName: 'Username',
		name: 'username',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['booking'], operation: ['create'], identifyBy: ['usernameSlug'] },
		},
		description: 'The host\'s 42min username, the part after the slash in their booking link',
		routing: { send: { type: 'body', property: 'username' } },
	},
	{
		displayName: 'Event Slug',
		name: 'eventSlug',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['booking'], operation: ['create'], identifyBy: ['usernameSlug'] },
		},
		routing: { send: { type: 'body', property: 'event_slug' } },
	},
	{
		displayName: 'Start',
		name: 'start',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['booking'], operation: ['create'] } },
		description: 'Start time of the meeting. Check it with Slot: Check first, since a slot that was free a moment ago may not be.',
		routing: { send: { type: 'body', property: 'start' } },
	},
	{
		displayName: 'Attendee Email',
		name: 'attendeeEmail',
		type: 'string',
		placeholder: 'name@email.com',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['booking'], operation: ['create'] } },
		description: 'Must be ASCII and deliverable. Accented local parts are rejected.',
		routing: { send: { type: 'body', property: 'attendee.email' } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['booking'], operation: ['create'] } },
		options: [
			{
				displayName: 'Attendee First Name',
				name: 'attendeeFirstName',
				type: 'string',
				default: '',
				routing: { send: { type: 'body', property: 'attendee.first_name' } },
			},
			{
				displayName: 'Attendee Last Name',
				name: 'attendeeLastName',
				type: 'string',
				default: '',
				routing: { send: { type: 'body', property: 'attendee.last_name' } },
			},
			{
				displayName: 'Attendee Name',
				name: 'attendeeName',
				type: 'string',
				default: '',
				routing: { send: { type: 'body', property: 'attendee.name' } },
			},
			{
				displayName: 'Attendee Phone',
				name: 'attendeePhone',
				type: 'string',
				default: '',
				routing: { send: { type: 'body', property: 'attendee.phone' } },
			},
			{
				displayName: 'Attendee Timezone',
				name: 'attendeeTimezone',
				type: 'string',
				default: '',
				placeholder: 'Europe/Lisbon',
				description: 'IANA timezone the attendee sees times in',
				routing: { send: { type: 'body', property: 'attendee.timezone' } },
			},
			{
				displayName: 'Guests',
				name: 'guests',
				type: 'string',
				default: '',
				placeholder: 'a@example.com, b@example.com',
				description: 'Comma-separated list of additional people to copy on the invitation',
				routing: {
					send: {
						type: 'body',
						property: 'guests',
						value: '={{ $value.split(",").map(e => e.trim()).filter(e => e !== "") }}',
					},
				},
			},
			{
				displayName: 'Metadata',
				name: 'metadata',
				type: 'json',
				default: '{}',
				description: 'Arbitrary key-value data returned unchanged on reads',
				routing: {
					send: {
						type: 'body',
						property: 'metadata',
						value: '={{ typeof $value === "string" ? JSON.parse($value) : $value }}',
					},
				},
			},
			{
				displayName: 'Responses',
				name: 'responses',
				type: 'json',
				default: '{}',
				description: 'Answers to the event type\'s invitee questions, keyed by question key',
				routing: {
					send: {
						type: 'body',
						property: 'responses',
						value: '={{ typeof $value === "string" ? JSON.parse($value) : $value }}',
					},
				},
			},
			{
				displayName: 'Timezone',
				name: 'timezone',
				type: 'string',
				default: '',
				placeholder: 'Europe/Lisbon',
				routing: { send: { type: 'body', property: 'timezone' } },
			},
			{
				displayName: 'UTM Campaign',
				name: 'utmCampaign',
				type: 'string',
				default: '',
				routing: { send: { type: 'body', property: 'utm_campaign' } },
			},
			{
				displayName: 'UTM Medium',
				name: 'utmMedium',
				type: 'string',
				default: '',
				routing: { send: { type: 'body', property: 'utm_medium' } },
			},
			{
				displayName: 'UTM Source',
				name: 'utmSource',
				type: 'string',
				default: '',
				routing: { send: { type: 'body', property: 'utm_source' } },
			},
		],
	},

	// ---------------------------------------------------------------- cancel
	{
		displayName: 'Reason',
		name: 'reason',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['booking'], operation: ['cancel'] } },
		description: 'Shown to the attendee in the cancellation email',
		routing: { send: { type: 'body', property: 'reason' } },
	},

	// ------------------------------------------------------------ reschedule
	{
		displayName: 'New Start',
		name: 'newStart',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['booking'], operation: ['reschedule'] } },
		routing: { send: { type: 'body', property: 'start' } },
	},
	{
		displayName: 'Options',
		name: 'rescheduleOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['booking'], operation: ['reschedule'] } },
		options: [
			{
				displayName: 'Reason',
				name: 'reason',
				type: 'string',
				default: '',
				routing: { send: { type: 'body', property: 'reason' } },
			},
			{
				displayName: 'Timezone',
				name: 'timezone',
				type: 'string',
				default: '',
				placeholder: 'Europe/Lisbon',
				routing: { send: { type: 'body', property: 'timezone' } },
			},
		],
	},

	// ---------------------------------------------------------------- update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['booking'], operation: ['update'] } },
		description:
			'Only these three fields are writable. To move a booking use Reschedule; to cancel it use Cancel.',
		options: [
			{
				displayName: 'Attendee Name',
				name: 'attendee_name',
				type: 'string',
				default: '',
				description: 'Truncated to 200 characters',
				routing: { send: { type: 'body', property: 'attendee_name' } },
			},
			{
				displayName: 'Metadata',
				name: 'metadata',
				type: 'json',
				default: '{}',
				description:
					'Shallow-merged into existing metadata, not replaced. There is no way to remove a key here.',
				routing: {
					send: {
						type: 'body',
						property: 'metadata',
						value: '={{ typeof $value === "string" ? JSON.parse($value) : $value }}',
					},
				},
			},
			{
				displayName: 'Responses',
				name: 'responses',
				type: 'json',
				default: '{}',
				description: 'Replaces the stored invitee form answers outright',
				routing: {
					send: {
						type: 'body',
						property: 'responses',
						value: '={{ typeof $value === "string" ? JSON.parse($value) : $value }}',
					},
				},
			},
		],
	},

	// --------------------------------------------------------------- get many
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: { show: { resource: ['booking'], operation: ['getAll'] } },
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
			show: { resource: ['booking'], operation: ['getAll'], returnAll: [false] },
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
		displayOptions: { show: { resource: ['booking'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'Attendee Email',
				name: 'attendee_email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
				routing: { send: { type: 'query', property: 'attendee_email' } },
			},
			{
				displayName: 'End Date',
				name: 'end_date',
				type: 'dateTime',
				default: '',
				routing: { send: { type: 'query', property: 'end_date' } },
			},
			{
				displayName: 'Event Type ID',
				name: 'event_type_id',
				type: 'string',
				default: '',
				routing: { send: { type: 'query', property: 'event_type_id' } },
			},
			{
				displayName: 'Host User ID',
				name: 'host_user_id',
				type: 'string',
				default: '',
				routing: { send: { type: 'query', property: 'host_user_id' } },
			},
			{
				displayName: 'Include Canceled',
				name: 'include_cancelled',
				type: 'boolean',
				default: true,
				routing: {
					send: { type: 'query', property: 'include_cancelled', value: '={{ $value ? "true" : "false" }}' },
				},
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				default: 'start_at_desc',
				options: [
					{ name: 'Created At (Newest First)', value: 'created_at_desc' },
					{ name: 'Created At (Oldest First)', value: 'created_at_asc' },
					{ name: 'Start At (Newest First)', value: 'start_at_desc' },
					{ name: 'Start At (Oldest First)', value: 'start_at_asc' },
				],
				routing: { send: { type: 'query', property: 'sort' } },
			},
			{
				displayName: 'Start Date',
				name: 'start_date',
				type: 'dateTime',
				default: '',
				routing: { send: { type: 'query', property: 'start_date' } },
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'string',
				default: '',
				placeholder: 'confirmed,cancelled',
				description: 'Comma-separated list of statuses',
				routing: { send: { type: 'query', property: 'status' } },
			},
			{
				displayName: 'Updated Since',
				name: 'updated_since',
				type: 'dateTime',
				default: '',
				description: 'Only bookings modified at or after this instant. Use for incremental sync.',
				routing: { send: { type: 'query', property: 'updated_since' } },
			},
		],
	},
];
