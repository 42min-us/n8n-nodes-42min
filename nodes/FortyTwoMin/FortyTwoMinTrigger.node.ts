import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	fortyTwoMinApiRequest,
	normalizeBookingEvent,
	verifyWebhookSignature,
} from './GenericFunctions';

interface WebhookStaticData {
	webhookId?: string;
	signingSecret?: string;
}

export class FortyTwoMinTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: '42min Trigger',
		name: 'fortyTwoMinTrigger',
		icon: { light: 'file:../../icons/fortytwomin.svg', dark: 'file:../../icons/fortytwomin.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts a workflow when something happens in 42min',
		defaults: { name: '42min Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'fortyTwoMinApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
				rawBody: true,
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: ['booking_created'],
				description: 'The events to subscribe to',
				options: [
					{ name: 'Booking Canceled', value: 'booking_canceled' },
					{ name: 'Booking Created', value: 'booking_created' },
					{ name: 'Booking Marked No-Show', value: 'booking_no_show' },
					{ name: 'Booking Rescheduled', value: 'booking_rescheduled' },
					{ name: 'Booking Updated', value: 'booking_updated' },
					{ name: 'Event Type Deleted', value: 'event_type_deleted' },
					{ name: 'Event Type Updated', value: 'event_type_updated' },
					{ name: 'Routing Form Submitted', value: 'routing_form_submitted' },
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Raw Payload',
						name: 'rawPayload',
						type: 'boolean',
						default: false,
						description:
							'Whether to emit the delivery exactly as 42min sent it. By default booking events are reshaped into the same flat, snake_case field names the REST API uses, so a trigger item and a lookup item can be read the same way.',
					},
					{
						displayName: 'Timestamp Tolerance (Seconds)',
						name: 'tolerance',
						type: 'number',
						default: 300,
						typeOptions: { minValue: 0 },
						description:
							'Reject deliveries whose signature timestamp is older than this. Guards against a captured delivery being replayed.',
					},
					{
						displayName: 'Verify Signature',
						name: 'verifySignature',
						type: 'boolean',
						default: true,
						description:
							'Whether to check the X-42min-Webhook-Signature header and reject anything that fails. Turn this off only if your reverse proxy rewrites the request body.',
					},
				],
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node') as WebhookStaticData;
				const webhookUrl = this.getNodeWebhookUrl('default');

				const response = await fortyTwoMinApiRequest.call(this, 'GET', '/v1/webhooks');
				const existing = ((response.data as IDataObject[]) ?? []).find(
					(hook) => hook.url === webhookUrl,
				);

				if (!existing) {
					delete staticData.webhookId;
					delete staticData.signingSecret;
					return false;
				}

				// The signing secret is returned only when a subscription is created. If we
				// have the subscription but not its secret, we can never verify a delivery
				// against it, so drop it and let create() mint a fresh pair. Leaving it in
				// place would also make the next create() a duplicate: this endpoint takes
				// no Idempotency-Key, and both subscriptions would deliver.
				if (!staticData.signingSecret) {
					await fortyTwoMinApiRequest
						.call(this, 'DELETE', `/v1/webhooks/${existing.id as string}`)
						.catch(() => undefined);
					delete staticData.webhookId;
					return false;
				}

				staticData.webhookId = existing.id as string;
				return true;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node') as WebhookStaticData;
				const webhookUrl = this.getNodeWebhookUrl('default');
				const events = this.getNodeParameter('events') as string[];

				if (!webhookUrl?.startsWith('https://')) {
					throw new NodeOperationError(
						this.getNode(),
						'42min delivers webhooks over HTTPS only, and this n8n instance is reachable at a non-HTTPS URL',
						{
							description:
								'Set WEBHOOK_URL (or N8N_PROTOCOL/N8N_HOST) so n8n advertises a public https:// address, then activate the workflow again. The address must also resolve to a public IP: 42min refuses to deliver to private ranges.',
						},
					);
				}

				const response = await fortyTwoMinApiRequest.call(this, 'POST', '/v1/webhooks', {
					url: webhookUrl,
					events,
					description: `n8n: ${this.getWorkflow().name ?? 'workflow'}`,
				});

				const created = (response.data ?? {}) as IDataObject;
				if (!created.id || !created.signing_secret) {
					throw new NodeOperationError(
						this.getNode(),
						'42min did not return a subscription ID and signing secret',
					);
				}

				staticData.webhookId = created.id as string;
				staticData.signingSecret = created.signing_secret as string;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node') as WebhookStaticData;
				if (!staticData.webhookId) return true;

				try {
					await fortyTwoMinApiRequest.call(
						this,
						'DELETE',
						`/v1/webhooks/${staticData.webhookId}`,
					);
				} catch (error) {
					// Deleting is race-safe but not repeat-idempotent: a subscription that is
					// already gone answers 404. That is the state we wanted either way.
					const status = (error as IDataObject)?.httpCode ?? (error as IDataObject)?.statusCode;
					if (String(status) !== '404') return false;
				}

				delete staticData.webhookId;
				delete staticData.signingSecret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const staticData = this.getWorkflowStaticData('node') as WebhookStaticData;
		const options = this.getNodeParameter('options', {}) as IDataObject;
		const headers = this.getHeaderData() as IDataObject;
		const request = this.getRequestObject() as unknown as { rawBody?: Buffer };

		const verify = options.verifySignature !== false;
		const rawBody = request.rawBody;

		if (verify) {
			if (!rawBody) {
				throw new NodeOperationError(
					this.getNode(),
					'The raw request body was not available, so the webhook signature could not be verified',
					{
						description:
							'Something between 42min and n8n is re-serializing the request. Fix the proxy, or turn off Verify Signature if you accept unauthenticated deliveries.',
					},
				);
			}

			const result = verifyWebhookSignature(
				rawBody,
				headers['x-42min-webhook-signature'] as string | undefined,
				staticData.signingSecret ?? '',
				(options.tolerance as number) ?? 300,
			);

			if (!result.ok) {
				const response = this.getResponseObject();
				response.status(401).send(`Webhook signature rejected: ${result.reason}`);
				return { noWebhookResponse: true };
			}
		}

		let envelope: IDataObject;
		if (rawBody) {
			try {
				envelope = JSON.parse(rawBody.toString('utf8')) as IDataObject;
			} catch {
				envelope = this.getBodyData() as IDataObject;
			}
		} else {
			envelope = this.getBodyData() as IDataObject;
		}

		const isBookingEvent = String(envelope.event ?? '').startsWith('booking.');
		const emitRaw = options.rawPayload === true || !isBookingEvent;
		const item = emitRaw ? envelope : normalizeBookingEvent(envelope);

		// The delivery id is stable across retries; the event id is not what you dedupe on.
		item.delivery_id = (headers['x-42min-webhook-id'] as string) ?? null;
		item.delivery_attempt = (headers['x-42min-webhook-attempt'] as string) ?? null;

		return { workflowData: [this.helpers.returnJsonArray([item])] };
	}
}
