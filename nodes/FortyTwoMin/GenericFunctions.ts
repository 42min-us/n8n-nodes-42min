import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
	IDataObject,
	JsonObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	IWebhookFunctions,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

type RequestContext =
	| IExecuteFunctions
	| IHookFunctions
	| ILoadOptionsFunctions
	| IWebhookFunctions;

/**
 * Call the 42min REST API with the node's credential and unwrap the `{data, meta}`
 * envelope. Used by the trigger and the dynamic dropdowns; the action node routes
 * declaratively and does not go through here.
 */
export async function fortyTwoMinApiRequest(
	this: RequestContext,
	method: IHttpRequestMethods,
	resource: string,
	body: IDataObject = {},
	qs: IDataObject = {},
): Promise<IDataObject> {
	const credentials = await this.getCredentials('fortyTwoMinApi');
	const baseUrl = ((credentials.baseUrl as string) || 'https://api.42min.us').replace(/\/+$/, '');

	try {
		const response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'fortyTwoMinApi',
			{
				method,
				url: `${baseUrl}${resource}`,
				body: Object.keys(body).length ? body : undefined,
				qs: Object.keys(qs).length ? qs : undefined,
				headers: { Accept: 'application/json' },
				json: true,
			},
		)) as IDataObject;

		return response;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

/**
 * Verify the `X-42min-Webhook-Signature` header.
 *
 * 42min signs `${timestamp}.${rawBody}` with HMAC-SHA256 and sends
 * `t=<unix-seconds>,v1=<hex>`. The raw bytes matter: re-serializing the parsed
 * body may reorder keys or change escaping, and the signature will not match.
 */
export function verifyWebhookSignature(
	rawBody: Buffer | string,
	signatureHeader: string | undefined,
	secret: string,
	toleranceSeconds = 300,
): { ok: true } | { ok: false; reason: string } {
	if (!signatureHeader) return { ok: false, reason: 'missing X-42min-Webhook-Signature header' };
	if (!secret) return { ok: false, reason: 'no signing secret stored for this trigger' };

	const parts: Record<string, string> = Object.create(null);
	for (const piece of String(signatureHeader).split(',')) {
		const eq = piece.indexOf('=');
		if (eq === -1) continue;
		parts[piece.slice(0, eq).trim()] = piece.slice(eq + 1).trim();
	}

	const timestamp = parts.t;
	const provided = parts.v1;
	if (!timestamp || !provided) return { ok: false, reason: 'malformed signature header' };
	if (!/^\d+$/.test(timestamp)) return { ok: false, reason: 'malformed timestamp' };

	// Replay window. Without it, a captured delivery can be resent verbatim
	// forever and still validate.
	const ageSeconds = Math.floor(Date.now() / 1000) - Number(timestamp);
	if (Math.abs(ageSeconds) > toleranceSeconds) {
		return { ok: false, reason: `timestamp outside tolerance (${ageSeconds}s)` };
	}

	const expected = createHmac('sha256', secret)
		.update(Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), Buffer.from(rawBody)]))
		.digest('hex');

	const a = Buffer.from(expected, 'utf8');
	const b = Buffer.from(provided, 'utf8');
	// timingSafeEqual throws on a length mismatch, so compare lengths first.
	if (a.length !== b.length) return { ok: false, reason: 'signature mismatch' };
	if (!timingSafeEqual(a, b)) return { ok: false, reason: 'signature mismatch' };

	return { ok: true };
}

/**
 * Reshape a booking webhook delivery into the same flat, snake_case vocabulary the
 * REST API uses.
 *
 * Deliveries are nested camelCase (`data.booking.startTime`) while `/v1/bookings`
 * is flat snake_case (`start_at`). Without this, a workflow would have to learn two
 * different names for every field depending on whether the item came from a trigger
 * or from a lookup. The envelope fields are kept under `event_*` so nothing is lost.
 */
export function normalizeBookingEvent(envelope: IDataObject): IDataObject {
	const data = (envelope.data ?? {}) as IDataObject;
	const booking = (data.booking ?? {}) as IDataObject;
	const host = (booking.hostUser ?? {}) as IDataObject;
	const previous = data.previousBooking as IDataObject | undefined;

	const hostName = [host.firstName, host.lastName].filter(Boolean).join(' ').trim();

	// Deliveries carry guests as whatever the booking stored; the REST API always
	// returns objects. Normalize bare strings up to the object shape.
	const guests = Array.isArray(booking.guests)
		? (booking.guests as unknown[]).map((g) =>
				typeof g === 'string' ? { email: g, name: null } : (g as IDataObject),
			)
		: [];

	return {
		event_id: envelope.id ?? null,
		event: envelope.event ?? null,
		occurred_at: envelope.createdAt ?? null,
		api_version: envelope.apiVersion ?? null,

		uid: booking.id ?? null,
		event_type_id: booking.eventTypeId ?? null,
		event_type_slug: null,
		title: booking.eventTypeName ?? null,
		status: booking.status ?? null,
		start_at: booking.startTime ?? null,
		end_at: booking.endTime ?? null,
		timezone: booking.timezone ?? null,

		host: {
			user_id: host.id ?? null,
			username: null,
			email: host.email ?? null,
			name: hostName || null,
		},
		attendees: [
			{
				email: booking.inviteeEmail ?? null,
				name: booking.inviteeName ?? null,
				phone: booking.inviteePhone ?? null,
				timezone: booking.timezone ?? null,
			},
		],
		guests,

		location: {
			type: null,
			url: booking.meetLink ?? null,
			value: booking.location ?? null,
		},
		metadata: booking.urlParams ?? {},
		responses: booking.answers ?? null,
		responses_by_id: booking.answersById ?? null,
		routing_form_answers: booking.routingFormAnswers ?? null,

		calendar_sync_status: null,
		calendar_event_id: null,
		rescheduled_from_uid: null,
		rescheduled_at: booking.rescheduledAt ?? null,
		reschedule_generation: booking.reschedule_generation ?? 0,
		previous_start_at: previous?.startTime ?? null,
		previous_end_at: previous?.endTime ?? null,
		previous_timezone: previous?.timezone ?? null,

		cancelled_at: booking.cancelledAt ?? null,
		cancellation_reason: booking.cancelledReason ?? null,
		no_show_at: booking.noShowAt ?? null,
		no_show_reason: booking.noShowReason ?? null,

		organization_id: booking.organizationId ?? null,
	};
}

