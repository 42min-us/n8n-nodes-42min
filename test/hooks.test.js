// Drives the trigger's subscribe/unsubscribe hooks against a stub that answers
// like /v1/webhooks does, including the cases that are awkward to reach by hand:
// a subscription whose signing secret we no longer hold, and a delete that 404s.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { FortyTwoMinTrigger } = require('../dist/nodes/FortyTwoMin/FortyTwoMinTrigger.node.js');

function startStub(state) {
	const server = http.createServer((req, res) => {
		const chunks = [];
		req.on('data', (c) => chunks.push(c));
		req.on('end', () => {
			const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
			state.calls.push({ method: req.method, path: req.url, body });
			const json = (code, payload) => {
				res.writeHead(code, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify(payload));
			};
			if (req.url === '/v1/webhooks' && req.method === 'GET') {
				return json(200, { data: state.existing, meta: {} });
			}
			if (req.url === '/v1/webhooks' && req.method === 'POST') {
				return json(201, {
					data: { id: 'wh_new', url: body.url, events: body.events, signing_secret: 'whsec_new' },
					meta: {},
				});
			}
			if (req.method === 'DELETE') {
				if (state.deleteStatus === 404) {
					return json(404, { error: { code: 'not_found', message: 'gone', request_id: 'r' } });
				}
				res.writeHead(204);
				return res.end();
			}
			json(404, { error: { code: 'not_found', message: req.url, request_id: 'r' } });
		});
	});
	return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/** Enough of IHookFunctions for the three lifecycle hooks. */
function makeContext(port, staticData, params = {}) {
	const base = `http://127.0.0.1:${port}`;
	return {
		staticData,
		getWorkflowStaticData: () => staticData,
		getNodeWebhookUrl: () => params.webhookUrl ?? 'https://n8n.example.com/webhook/abc/webhook',
		getNodeParameter: (name) => params[name] ?? ['booking_created'],
		getWorkflow: () => ({ name: 'Test workflow' }),
		getNode: () => ({ name: '42min Trigger', type: 'fortyTwoMinTrigger' }),
		getCredentials: async () => ({ accessToken: 'tok', baseUrl: base }),
		helpers: {
			async httpRequestWithAuthentication(_type, options) {
				const res = await fetch(options.url, {
					method: options.method,
					headers: { ...options.headers, Authorization: 'Bearer tok' },
					body: options.body ? JSON.stringify(options.body) : undefined,
				});
				if (!res.ok) {
					const err = new Error(`HTTP ${res.status}`);
					err.httpCode = String(res.status);
					err.statusCode = res.status;
					throw err;
				}
				return res.status === 204 ? {} : await res.json();
			},
		},
	};
}

const hooks = new FortyTwoMinTrigger().webhookMethods.default;

test('checkExists reports no subscription when 42min has none', async () => {
	const state = { existing: [], calls: [] };
	const server = await startStub(state);
	const ctx = makeContext(server.address().port, {});
	assert.equal(await hooks.checkExists.call(ctx), false);
	server.close();
});

test('create registers the URL and stores the secret only it will ever see', async () => {
	const state = { existing: [], calls: [] };
	const server = await startStub(state);
	const staticData = {};
	const ctx = makeContext(server.address().port, staticData, {
		events: ['booking_created', 'booking_canceled'],
	});

	assert.equal(await hooks.create.call(ctx), true);
	assert.equal(staticData.webhookId, 'wh_new');
	assert.equal(staticData.signingSecret, 'whsec_new');

	const post = state.calls.find((c) => c.method === 'POST');
	assert.deepEqual(post.body.events, ['booking_created', 'booking_canceled']);
	assert.equal(post.body.url, 'https://n8n.example.com/webhook/abc/webhook');
	server.close();
});

test('create refuses a non-HTTPS callback instead of registering one 42min cannot reach', async () => {
	const state = { existing: [], calls: [] };
	const server = await startStub(state);
	const ctx = makeContext(server.address().port, {}, {
		webhookUrl: 'http://192.168.1.10:5678/webhook/abc/webhook',
	});
	await assert.rejects(() => hooks.create.call(ctx), /HTTPS only/);
	assert.equal(state.calls.length, 0, 'must not call the API at all');
	server.close();
});

test('checkExists discards a subscription whose signing secret is lost', async () => {
	// Without the secret no delivery can ever be verified, and re-creating without
	// removing this one would leave two subscriptions both delivering.
	const state = {
		existing: [{ id: 'wh_orphan', url: 'https://n8n.example.com/webhook/abc/webhook' }],
		calls: [],
	};
	const server = await startStub(state);
	const staticData = { webhookId: 'wh_orphan' };
	const ctx = makeContext(server.address().port, staticData);

	assert.equal(await hooks.checkExists.call(ctx), false, 'should ask for a fresh one');
	assert.ok(
		state.calls.some((c) => c.method === 'DELETE' && c.path === '/v1/webhooks/wh_orphan'),
		'should have removed the unusable subscription',
	);
	assert.equal(staticData.webhookId, undefined);
	server.close();
});

test('checkExists keeps a subscription it can still verify', async () => {
	const state = {
		existing: [{ id: 'wh_good', url: 'https://n8n.example.com/webhook/abc/webhook' }],
		calls: [],
	};
	const server = await startStub(state);
	const staticData = { webhookId: 'wh_good', signingSecret: 'whsec_kept' };
	const ctx = makeContext(server.address().port, staticData);

	assert.equal(await hooks.checkExists.call(ctx), true);
	assert.equal(staticData.signingSecret, 'whsec_kept');
	assert.ok(!state.calls.some((c) => c.method === 'DELETE'));
	server.close();
});

test('delete clears local state', async () => {
	const state = { existing: [], calls: [] };
	const server = await startStub(state);
	const staticData = { webhookId: 'wh_new', signingSecret: 'whsec_new' };
	const ctx = makeContext(server.address().port, staticData);

	assert.equal(await hooks.delete.call(ctx), true);
	assert.equal(staticData.webhookId, undefined);
	assert.equal(staticData.signingSecret, undefined);
	server.close();
});

test('delete treats an already-gone subscription as success', async () => {
	// DELETE is race-safe but not repeat-idempotent: a second call 404s. That is
	// still the state we wanted.
	const state = { existing: [], calls: [], deleteStatus: 404 };
	const server = await startStub(state);
	const staticData = { webhookId: 'wh_gone', signingSecret: 'whsec' };
	const ctx = makeContext(server.address().port, staticData);

	assert.equal(await hooks.delete.call(ctx), true);
	assert.equal(staticData.webhookId, undefined);
	server.close();
});

test('delete with nothing registered is a no-op', async () => {
	const state = { existing: [], calls: [] };
	const server = await startStub(state);
	const ctx = makeContext(server.address().port, {});
	assert.equal(await hooks.delete.call(ctx), true);
	assert.equal(state.calls.length, 0);
	server.close();
});
