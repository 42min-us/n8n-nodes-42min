import type { INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { bookingFields, bookingOperations } from './descriptions/BookingDescription';
import { eventTypeFields, eventTypeOperations } from './descriptions/EventTypeDescription';
import { seriesFields, seriesOperations } from './descriptions/SeriesDescription';
import { slotFields, slotOperations } from './descriptions/SlotDescription';
import { userFields, userOperations } from './descriptions/UserDescription';

export class FortyTwoMin implements INodeType {
	description: INodeTypeDescription = {
		displayName: '42min',
		name: 'fortyTwoMin',
		icon: { light: 'file:../../icons/fortytwomin.svg', dark: 'file:../../icons/fortytwomin.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Read and write bookings, recurring series, event types and availability in 42min',
		defaults: { name: '42min' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'fortyTwoMinApi', required: true }],
		requestDefaults: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}/v1',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Booking', value: 'booking' },
					{ name: 'Event Type', value: 'eventType' },
					{ name: 'Series', value: 'series' },
					{ name: 'Slot', value: 'slot' },
					{ name: 'User', value: 'user' },
				],
				default: 'booking',
			},

			...bookingOperations,
			...bookingFields,
			...eventTypeOperations,
			...eventTypeFields,
			...seriesOperations,
			...seriesFields,
			...slotOperations,
			...slotFields,
			...userOperations,
			...userFields,

			// Two entries so each resource shows the field only on the operations that
			// actually send the header (a series update locks with If-Match instead).
			{
				displayName: 'Idempotency Key',
				name: 'idempotencyKey',
				type: 'string',
				default: '',
				displayOptions: {
					show: { resource: ['booking'], operation: ['create', 'update', 'cancel', 'reschedule'] },
				},
				description:
					'Leave empty to derive one from the execution and item. Set it to a stable value of your own, such as a CRM record ID, when the same logical operation may be attempted from more than one execution.',
			},
			{
				displayName: 'Idempotency Key',
				name: 'idempotencyKey',
				type: 'string',
				default: '',
				displayOptions: {
					show: { resource: ['series'], operation: ['create', 'resume', 'end'] },
				},
				description:
					'Leave empty to derive one from the execution and item. Set it to a stable value of your own, such as a CRM record ID, when the same logical operation may be attempted from more than one execution.',
			},
		],
	};
}
