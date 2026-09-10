import type { INodeType, INodeTypeDescription } from 'n8n-workflow';

import { bookingFields, bookingOperations } from './descriptions/BookingDescription';
import { eventTypeFields, eventTypeOperations } from './descriptions/EventTypeDescription';
import { slotFields, slotOperations } from './descriptions/SlotDescription';
import { userFields, userOperations } from './descriptions/UserDescription';

export class FortyTwoMin implements INodeType {
	description: INodeTypeDescription = {
		displayName: '42min',
		name: 'fortyTwoMin',
		icon: 'file:fortytwomin.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Read and write bookings, event types and availability in 42min',
		defaults: { name: '42min' },
		inputs: ['main'],
		outputs: ['main'],
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
					{ name: 'Slot', value: 'slot' },
					{ name: 'User', value: 'user' },
				],
				default: 'booking',
			},

			...bookingOperations,
			...bookingFields,
			...eventTypeOperations,
			...eventTypeFields,
			...slotOperations,
			...slotFields,
			...userOperations,
			...userFields,

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
		],
	};
}
