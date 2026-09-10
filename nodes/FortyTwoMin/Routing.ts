import { createHash } from 'node:crypto';
import type {
	IDataObject,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	IN8nRequestOperations,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

/**
 * Every 42min response is wrapped in `{data, meta}`. Without this, each node would
 * emit the wrapper instead of the record.
 */
export const unwrap = {
	type: 'rootProperty' as const,
	properties: { property: 'data' },
};

/** Follow `meta.next_cursor` while `meta.has_more`, but only when Return All is on. */
export const cursorPagination: IN8nRequestOperations = {
	pagination: {
		type: 'generic',
		properties: {
			// Only reached when Return All set requestData.paginate, so this need not
			// re-check the parameter; $parameter does not resolve in this context anyway.
			continue: '={{ $response.body.meta.has_more === true }}',
			// n8n merges this over requestData.options, and `qs` is replaced rather than
			// merged, so the filters the user set would be dropped from page two onward.
			// Rebuild the query from $request.qs instead of naming only the paging keys.
			request: {
				// The type wants a plain object, but n8n resolves this whole value as one
				// expression at request time, which is the only way to carry the existing
				// query through. Hence the cast.
				qs: "={{ Object.assign({}, $request.qs, { limit: 100, cursor: $response.body && $response.body.meta ? $response.body.meta.next_cursor : undefined }) }}" as unknown as IDataObject,
			},
		},
	},
};

/**
 * `Idempotency-Key` is required on writes: omitting it returns 400 and the request is
 * not performed.
 *
 * The key is derived from the execution, node and item, so an in-execution retry
 * replays the original result instead of creating a second booking. A deliberate
 * re-run of the workflow gets a new execution id and therefore a new key, which is
 * correct: that is a new operation, not a retry.
 */
export async function addIdempotencyKey(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	let provided = '';
	try {
		provided = (this.getNodeParameter('idempotencyKey', '') as string) ?? '';
	} catch {
		provided = '';
	}

	const key = provided.trim()
		? provided.trim().slice(0, 255)
		: createHash('sha256')
				.update(
					[
						this.getExecutionId(),
						this.getNode().name,
						this.getNodeParameter('operation', '') as string,
						String(this.getItemIndex()),
					].join(':'),
				)
				.digest('hex');

	requestOptions.headers = { ...requestOptions.headers, 'Idempotency-Key': key };
	return requestOptions;
}

/**
 * `If-Match` is required on PATCH: omitting it returns 428 and the booking is not
 * modified. Read the booking first and send back the ETag it returned, so a
 * concurrent edit fails loudly with a 409 instead of being silently overwritten.
 */
export async function addIfMatch(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const uid = this.getNodeParameter('uid') as string;
	const credentials = await this.getCredentials('fortyTwoMinApi');
	const baseUrl = ((credentials.baseUrl as string) || 'https://api.42min.us').replace(/\/+$/, '');

	const response = (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'fortyTwoMinApi',
		{
			method: 'GET',
			url: `${baseUrl}/v1/bookings/${encodeURIComponent(uid)}`,
			headers: { Accept: 'application/json' },
			returnFullResponse: true,
			json: true,
		},
	)) as { headers?: IDataObject };

	const headers = response.headers ?? {};
	const etag = (headers.etag ?? headers.ETag) as string | undefined;
	if (!etag) {
		throw new NodeOperationError(
			this.getNode(),
			`Could not read an ETag for booking ${uid}, so the update was not attempted`,
			{ description: 'Updating a booking requires the version token from a prior read.' },
		);
	}

	requestOptions.headers = { ...requestOptions.headers, 'If-Match': etag };
	return requestOptions;
}
