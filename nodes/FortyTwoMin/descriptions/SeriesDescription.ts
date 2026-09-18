import type { INodeProperties } from 'n8n-workflow';
import { addIdempotencyKey, addIfMatch, cursorPagination, unwrap } from '../Routing';

const WEEKDAYS = [
	{ name: 'Monday', value: 'mon' },
	{ name: 'Tuesday', value: 'tue' },
	{ name: 'Wednesday', value: 'wed' },
	{ name: 'Thursday', value: 'thu' },
	{ name: 'Friday', value: 'fri' },
	{ name: 'Saturday', value: 'sat' },
	{ name: 'Sunday', value: 'sun' },
];

const FREQUENCIES = [
	{ name: 'Monthly (Same Day)', value: 'monthly_same_day' },
	{ name: 'Weekly', value: 'weekly' },
];

// The API takes a civil date for starts_on. n8n's date picker yields a timestamp,
// so send only its date part.
const CIVIL_DATE = '={{ String($value).slice(0, 10) }}';

export const seriesOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['series'] } },
		options: [
			{
				name: 'Change Host',
				value: 'changeHost',
				action: 'Change the host of a series',
				description: 'Move the series and every upcoming occurrence to another host',
				routing: {
					request: { method: 'POST', url: '=/series/{{$parameter.uid}}/host' },
					output: { postReceive: [unwrap] },
				},
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a series',
				description:
					'Book a recurring meeting series. Dates the host is not free on are skipped, not shifted.',
				routing: {
					request: { method: 'POST', url: '/series' },
					send: { preSend: [addIdempotencyKey] },
					output: { postReceive: [unwrap] },
				},
			},
			{
				name: 'End',
				value: 'end',
				action: 'End a series',
				description: 'Cancel every upcoming occurrence for good. The series cannot be resumed.',
				routing: {
					request: { method: 'POST', url: '=/series/{{$parameter.uid}}/end' },
					send: { preSend: [addIdempotencyKey] },
					output: { postReceive: [unwrap] },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a series',
				description: 'Retrieve a series with its next occurrence and how many remain',
				routing: {
					request: { method: 'GET', url: '=/series/{{$parameter.uid}}' },
					output: { postReceive: [unwrap] },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many series',
				description: 'Retrieve a list of recurring series',
				routing: {
					request: { method: 'GET', url: '/series' },
					operations: cursorPagination,
					output: { postReceive: [unwrap] },
				},
			},
			{
				name: 'Pause',
				value: 'pause',
				action: 'Pause a series',
				description:
					'Cancel the upcoming occurrences and hold them, so Resume books a replacement for each',
				routing: {
					request: { method: 'POST', url: '=/series/{{$parameter.uid}}/pause' },
					output: { postReceive: [unwrap] },
				},
			},
			{
				name: 'Resume',
				value: 'resume',
				action: 'Resume a series',
				description: 'Book replacements for the held occurrences on the pattern\'s next free dates',
				routing: {
					request: { method: 'POST', url: '=/series/{{$parameter.uid}}/resume' },
					send: { preSend: [addIdempotencyKey] },
					output: { postReceive: [unwrap] },
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a series',
				description:
					'Change the repeat pattern, the fixed link, or whether the attendee is notified',
				routing: {
					request: { method: 'PATCH', url: '=/series/{{$parameter.uid}}' },
					send: { preSend: [addIfMatch] },
					output: { postReceive: [unwrap] },
				},
			},
		],
		default: 'getAll',
	},
];

export const seriesFields: INodeProperties[] = [
	{
		displayName: 'Series UID',
		name: 'uid',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['series'],
				operation: ['get', 'update', 'pause', 'resume', 'end', 'changeHost'],
			},
		},
		description: 'The series UID. A booking that belongs to a series carries it as series_id.',
	},

	// ---------------------------------------------------------------- create
	{
		displayName: 'Identify Event Type By',
		name: 'identifyBy',
		type: 'options',
		default: 'eventTypeId',
		displayOptions: { show: { resource: ['series'], operation: ['create'] } },
		options: [
			{ name: 'Event Type ID', value: 'eventTypeId' },
			{ name: 'Username and Slug', value: 'usernameSlug' },
		],
		description: 'The event type must have recurring meetings turned on',
	},
	{
		displayName: 'Event Type ID',
		name: 'eventTypeId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['series'], operation: ['create'], identifyBy: ['eventTypeId'] },
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
			show: { resource: ['series'], operation: ['create'], identifyBy: ['usernameSlug'] },
		},
		routing: { send: { type: 'body', property: 'username' } },
	},
	{
		displayName: 'Event Slug',
		name: 'eventSlug',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['series'], operation: ['create'], identifyBy: ['usernameSlug'] },
		},
		routing: { send: { type: 'body', property: 'event_slug' } },
	},
	{
		displayName: 'Host User ID',
		name: 'hostUserId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['series'], operation: ['create'] } },
		description:
			'Whose calendar the series is booked on. User: Get Current returns your own ID.',
		routing: { send: { type: 'body', property: 'host_user_id' } },
	},
	{
		displayName: 'Attendee Email',
		name: 'attendeeEmail',
		type: 'string',
		placeholder: 'name@email.com',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['series'], operation: ['create'] } },
		routing: { send: { type: 'body', property: 'attendee.email' } },
	},
	{
		displayName: 'Frequency',
		name: 'frequency',
		type: 'options',
		required: true,
		default: 'weekly',
		options: FREQUENCIES,
		displayOptions: { show: { resource: ['series'], operation: ['create'] } },
		routing: { send: { type: 'body', property: 'frequency' } },
	},
	{
		displayName: 'Weekdays',
		name: 'weekdays',
		type: 'multiOptions',
		required: true,
		default: [],
		options: WEEKDAYS,
		displayOptions: {
			show: { resource: ['series'], operation: ['create'], frequency: ['weekly'] },
		},
		routing: { send: { type: 'body', property: 'weekdays' } },
	},
	{
		displayName: 'Time',
		name: 'time',
		type: 'string',
		required: true,
		default: '',
		placeholder: '18:30',
		displayOptions: { show: { resource: ['series'], operation: ['create'] } },
		description: 'Wall clock time on a 24-hour clock, in the series timezone',
		routing: { send: { type: 'body', property: 'time' } },
	},
	{
		displayName: 'Starts On',
		name: 'startsOn',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['series'], operation: ['create'] } },
		description: 'The first day the pattern is walked from. Only the date part is used.',
		routing: { send: { type: 'body', property: 'starts_on', value: CIVIL_DATE } },
	},
	{
		displayName: 'Count',
		name: 'count',
		type: 'number',
		required: true,
		default: 4,
		typeOptions: { minValue: 1, maxValue: 42 },
		displayOptions: { show: { resource: ['series'], operation: ['create'] } },
		description: 'How many occurrences to book, up to 42',
		routing: { send: { type: 'body', property: 'count' } },
	},
	{
		displayName: 'Additional Fields',
		name: 'seriesAdditionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['series'], operation: ['create'] } },
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
				displayName: 'Interval (Weeks)',
				name: 'intervalWeeks',
				type: 'number',
				default: 1,
				typeOptions: { minValue: 1, maxValue: 8 },
				description: 'Weeks between repeats. Weekly patterns only.',
				routing: { send: { type: 'body', property: 'interval_weeks' } },
			},
			{
				displayName: 'Location URL',
				name: 'locationUrl',
				type: 'string',
				default: '',
				description:
					'A fixed link every occurrence carries instead of a generated conference. It can be replaced later but not added.',
				routing: { send: { type: 'body', property: 'location_url' } },
			},
			{
				displayName: 'Notify Invitee',
				name: 'notifyInvitee',
				type: 'boolean',
				default: true,
				description: 'Whether the attendee gets email about this series',
				routing: { send: { type: 'body', property: 'notify_invitee' } },
			},
			{
				displayName: 'Timezone',
				name: 'timezone',
				type: 'string',
				default: '',
				placeholder: 'Europe/Lisbon',
				description: 'IANA zone for Time. Defaults to the host\'s own zone.',
				routing: { send: { type: 'body', property: 'timezone' } },
			},
		],
	},

	// ---------------------------------------------------------------- update
	{
		displayName: 'Update Fields',
		name: 'seriesUpdateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['series'], operation: ['update'] } },
		description:
			'A pattern change rebooks the upcoming occurrences onto the new dates. The start date, count, attendee and event type are fixed for the life of a series.',
		options: [
			{
				displayName: 'Frequency',
				name: 'frequency',
				type: 'options',
				default: 'weekly',
				options: FREQUENCIES,
				routing: { send: { type: 'body', property: 'frequency' } },
			},
			{
				displayName: 'Interval (Weeks)',
				name: 'intervalWeeks',
				type: 'number',
				default: 1,
				typeOptions: { minValue: 1, maxValue: 8 },
				routing: { send: { type: 'body', property: 'interval_weeks' } },
			},
			{
				displayName: 'Location URL',
				name: 'locationUrl',
				type: 'string',
				default: '',
				description: 'Replaces the existing fixed link. A series created without one cannot gain one.',
				routing: { send: { type: 'body', property: 'location_url' } },
			},
			{
				displayName: 'Notify Invitee',
				name: 'notifyInvitee',
				type: 'boolean',
				default: true,
				description: 'Whether the attendee gets email about this series',
				routing: { send: { type: 'body', property: 'notify_invitee' } },
			},
			{
				displayName: 'Time',
				name: 'time',
				type: 'string',
				default: '',
				placeholder: '18:30',
				routing: { send: { type: 'body', property: 'time' } },
			},
			{
				displayName: 'Weekdays',
				name: 'weekdays',
				type: 'multiOptions',
				default: [],
				options: WEEKDAYS,
				routing: { send: { type: 'body', property: 'weekdays' } },
			},
		],
	},

	// ------------------------------------------------------------ change host
	{
		displayName: 'New Host User ID',
		name: 'newHostUserId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['series'], operation: ['changeHost'] } },
		description:
			'The user to move the series to. If the output has a stopped_by value the host was not changed, and the call can be repeated.',
		routing: { send: { type: 'body', property: 'host_user_id' } },
	},

	// --------------------------------------------------------------- get many
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: { show: { resource: ['series'], operation: ['getAll'] } },
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
			show: { resource: ['series'], operation: ['getAll'], returnAll: [false] },
		},
		description: 'Max number of results to return',
		routing: { send: { type: 'query', property: 'limit' } },
	},
	{
		displayName: 'Filters',
		name: 'seriesFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['series'], operation: ['getAll'] } },
		options: [
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
				displayName: 'Status',
				name: 'status',
				type: 'multiOptions',
				default: [],
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Ended', value: 'ended' },
					{ name: 'Paused', value: 'paused' },
				],
				routing: {
					send: { type: 'query', property: 'status', value: '={{ $value.join(",") }}' },
				},
			},
		],
	},
];
