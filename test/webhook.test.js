const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');

const {
	verifyWebhookSignature,
	normalizeBookingEvent,
} = require('../dist/nodes/FortyTwoMin/GenericFunctions.js');

const SECRET = 'whsec_test_abc123';

const envelope = {
	id: 'evt_9f1c3b7a',
	event: 'booking.rescheduled',
	createdAt: '2026-09-10T10:00:00.000Z',
	apiVersion: '2026-04-01',
	data: {
		booking: {
			id: 'bk_123',
			eventTypeId: 'et_9',
			eventTypeName: 'Intro call',
			startTime: '2026-09-15T14:00:00.000Z',
			endTime: '2026-09-15T14:42:00.000Z',
			timezone: 'Europe/Lisbon',
			status: 'confirmed',
			inviteeName: 'Ada Lovelace',
			inviteeEmail: 'ada@example.com',
			inviteePhone: null,
			guests: ['bob@example.com'],
			answers: { q1: 'yes' },
			answersById: { id1: 'yes' },
			routingFormAnswers: null,
			urlParams: { utm_source: 'n8n' },
			location: 'Google Meet',
			meetLink: 'https://meet.google.com/xyz',
			cancelledAt: null,
			cancelledReason: null,
			noShowAt: null,
			noShowReason: null,
			rescheduledAt: '2026-09-10T10:00:00.000Z',
			reschedule_generation: 2,
			hostUser: { id: 'u_1', firstName: 'Grace', lastName: 'Hopper', email: 'grace@42min.us' },
			organizationId: 'org_7',
		},
		previousBooking: {
			startTime: '2026-09-14T09:00:00.000Z',
			endTime: '2026-09-14T09:42:00.000Z',
			timezone: 'Europe/Lisbon',
		},
	},
};

function sign(body, secret = SECRET, timestamp = Math.floor(Date.now() / 1000)) {
	const v1 = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
	return `t=${timestamp},v1=${v1}`;
}

test('accepts a signature 42min actually produced', () => {
	const body = JSON.stringify(envelope);
	assert.deepEqual(verifyWebhookSignature(Buffer.from(body), sign(body), SECRET), { ok: true });
});

test('does not care about the order of the header parts', () => {
	const body = JSON.stringify(envelope);
	const [t, v1] = sign(body).split(',');
	assert.deepEqual(
		verifyWebhookSignature(Buffer.from(body), `${v1},${t}`, SECRET),
		{ ok: true },
	);
});

test('rejects a body changed by even one byte', () => {
	const body = JSON.stringify(envelope);
	const header = sign(body);
	const result = verifyWebhookSignature(Buffer.from(`${body} `), header, SECRET);
	assert.equal(result.ok, false);
	assert.equal(result.reason, 'signature mismatch');
});

test('rejects a correct signature made with the wrong secret', () => {
	const body = JSON.stringify(envelope);
	const result = verifyWebhookSignature(Buffer.from(body), sign(body, 'whsec_other'), SECRET);
	assert.equal(result.ok, false);
});

test('rejects a replayed delivery outside the tolerance window', () => {
	const body = JSON.stringify(envelope);
	const stale = Math.floor(Date.now() / 1000) - 400;
	const result = verifyWebhookSignature(Buffer.from(body), sign(body, SECRET, stale), SECRET);
	assert.equal(result.ok, false);
	assert.match(result.reason, /outside tolerance/);
});

test('rejects a missing or malformed header rather than passing it through', () => {
	const body = Buffer.from(JSON.stringify(envelope));
	assert.equal(verifyWebhookSignature(body, undefined, SECRET).ok, false);
	assert.equal(verifyWebhookSignature(body, 'garbage', SECRET).ok, false);
	assert.equal(verifyWebhookSignature(body, 't=abc,v1=def', SECRET).ok, false);
});

test('refuses to verify when no signing secret is stored', () => {
	const body = JSON.stringify(envelope);
	assert.equal(verifyWebhookSignature(Buffer.from(body), sign(body), '').ok, false);
});

test('normalizes a delivery into the REST vocabulary', () => {
	const item = normalizeBookingEvent(envelope);

	// The whole point: a trigger item and a Get Booking item use the same names.
	assert.equal(item.uid, 'bk_123');
	assert.equal(item.start_at, '2026-09-15T14:00:00.000Z');
	assert.equal(item.end_at, '2026-09-15T14:42:00.000Z');
	assert.equal(item.title, 'Intro call');
	assert.equal(item.event_type_id, 'et_9');

	assert.deepEqual(item.attendees, [
		{
			email: 'ada@example.com',
			name: 'Ada Lovelace',
			phone: null,
			timezone: 'Europe/Lisbon',
		},
	]);
	assert.equal(item.host.name, 'Grace Hopper');
	assert.equal(item.host.email, 'grace@42min.us');

	// Guests arrive as bare strings but the REST API always returns objects.
	assert.deepEqual(item.guests, [{ email: 'bob@example.com', name: null }]);

	assert.equal(item.location.url, 'https://meet.google.com/xyz');
	assert.deepEqual(item.metadata, { utm_source: 'n8n' });

	// Envelope fields are kept rather than dropped.
	assert.equal(item.event_id, 'evt_9f1c3b7a');
	assert.equal(item.event, 'booking.rescheduled');
	assert.equal(item.occurred_at, '2026-09-10T10:00:00.000Z');

	// A reschedule says where it came from.
	assert.equal(item.previous_start_at, '2026-09-14T09:00:00.000Z');
	assert.equal(item.reschedule_generation, 2);
});

test('survives a delivery with nothing in it', () => {
	const item = normalizeBookingEvent({});
	assert.equal(item.uid, null);
	assert.deepEqual(item.guests, []);
	assert.deepEqual(item.metadata, {});
	assert.equal(item.reschedule_generation, 0);
});

test('keeps the British spelling the contract fixes', () => {
	const item = normalizeBookingEvent({
		data: { booking: { cancelledAt: '2026-09-11T00:00:00.000Z', cancelledReason: 'conflict' } },
	});
	assert.equal(item.cancelled_at, '2026-09-11T00:00:00.000Z');
	assert.equal(item.cancellation_reason, 'conflict');
});
