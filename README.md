# n8n-nodes-42min

An [n8n](https://n8n.io) community node for [42min](https://42min.us), a meeting
scheduling platform. Create and manage bookings, look up availability, and start
workflows the moment something happens on a calendar.

This is a community node. It runs inside your own n8n instance and talks directly to
`api.42min.us`; nothing routes through a third party.

## Installation

In n8n, go to **Settings → Community Nodes → Install** and enter:

```
n8n-nodes-42min
```

Or install it manually next to your n8n data directory:

```bash
npm install n8n-nodes-42min
```

Requires n8n 1.x and Node.js 20.15 or newer.

## Credentials

The node authenticates with a **personal access token**.

1. In 42min, open **Settings → API** and create a token.
2. Give it the scopes you need. For everything this node offers:
   `user:read`, `event_types:read`, `slots:read`, `bookings:read`, `bookings:create`,
   `bookings:cancel`, `bookings:reschedule`, `bookings:update`, `webhooks:read`,
   `webhooks:write`.
3. In n8n, create a **42min API** credential and paste the token.

Use **Test** to confirm it works. Leave **Base URL** alone unless you run a
self-hosted 42min.

## Operations

### 42min (action node)

| Resource | Operations |
|---|---|
| **Booking** | Create, Get, Get Many, Update, Cancel, Reschedule |
| **Event Type** | Get, Get Many |
| **Slot** | Get Many, Check |
| **User** | Get Current |

### 42min Trigger

Starts a workflow on any of these events:

`booking_created`, `booking_updated`, `booking_canceled`, `booking_rescheduled`,
`booking_no_show`, `event_type_updated`, `event_type_deleted`,
`routing_form_submitted`.

Activating a workflow registers a webhook subscription with 42min automatically, and
deactivating it removes the subscription again.

## Things worth knowing

**Trigger items and lookup items use the same field names.** 42min delivers webhooks
in nested camelCase (`data.booking.startTime`) while the REST API is flat snake_case
(`start_at`). Booking triggers reshape the delivery into the REST vocabulary so you do
not have to learn two names for every field. The original envelope fields survive as
`event_id`, `event` and `occurred_at`. Set **Raw Payload** if you want the delivery
untouched.

**Deliveries are verified.** Every webhook is checked against its
`X-42min-Webhook-Signature` HMAC, with a replay window, and anything that fails is
rejected with a 401 instead of starting your workflow. Turn **Verify Signature** off
only if something between 42min and n8n rewrites the request body.

**Dedupe on `delivery_id`, not `event_id`.** The delivery id is stable across retries.
Both are attached to every trigger item.

**Writes are idempotent.** Booking creates, updates, cancels and reschedules send an
`Idempotency-Key` derived from the execution and item, so a retry inside one execution
replays the original result rather than double-booking. Set **Idempotency Key**
yourself when the same logical operation might be attempted from more than one
execution, for example keyed on a CRM record id.

**Get Event Type identifies by ID or by username plus slug.** A slug alone is not
enough, since it is unique per user rather than per account. The node encodes the
`username/slug` pair into the single path segment the API expects.

**Check the slot before you book.** Use **Slot: Check** first. A slot that was free a
moment ago may not be, and Create Booking sends real email and writes to a real
calendar.

**Updating a booking reads it first.** 42min requires the `If-Match` version token on
a PATCH, so the node fetches the booking, takes its ETag and sends it back. A
concurrent edit fails with a 409 rather than being silently overwritten. Only
`metadata`, `responses` and `attendee_name` are writable: to move a booking use
**Reschedule**, to cancel it use **Cancel**.

## Trigger requirements

42min delivers over HTTPS to public addresses only. Your n8n must be:

- reachable at an `https://` URL, and
- resolvable to a public IP. Deliveries to private ranges are refused.

If n8n advertises a non-HTTPS address the trigger will say so when you activate the
workflow. Set `WEBHOOK_URL` (or `N8N_PROTOCOL` and `N8N_HOST`) accordingly.

The action node has no such requirement: it only makes outbound calls, so it works
behind a firewall.

## Local development

```bash
npm install
npm run build
npm test
npm link

mkdir -p ~/.n8n/custom && cd ~/.n8n/custom
npm init -y && npm link n8n-nodes-42min
n8n start
```

For the trigger you need a publicly reachable n8n, so use `n8n start --tunnel` during
development.

## Resources

- [42min API reference](https://42min.us/help/api)
- [OpenAPI specification](https://api.42min.us/openapi.yaml)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE)
