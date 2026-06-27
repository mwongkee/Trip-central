import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { DynamoRepo } from './repo.js';
import { handleRequest, type ApiRequest, type Identity } from './router.js';
import { edgeSecretOk } from './edge.js';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'TripBoard';
// Set by Terraform; when present, requests must arrive via CloudFront (which injects it).
const EDGE_SECRET = process.env['EDGE_SECRET'];

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const repo = new DynamoRepo(ddb, TABLE_NAME);

/**
 * Resolve the caller's identity. Prefer Cognito JWT claims (if a JWT authorizer is
 * wired up); fall back to the device-join headers the SPA sends. See DECISIONS.md.
 */
function resolveIdentity(event: APIGatewayProxyEventV2): Identity | null {
  const authorizer = (event.requestContext as { authorizer?: { jwt?: { claims?: Record<string, unknown> } } })
    .authorizer;
  const claims = authorizer?.jwt?.claims;
  if (claims && typeof claims['sub'] === 'string') {
    const name =
      (typeof claims['name'] === 'string' && claims['name']) ||
      (typeof claims['email'] === 'string' && claims['email']) ||
      'Member';
    return { userId: claims['sub'], name: String(name) };
  }
  const headers = event.headers ?? {};
  const userId = headers['x-tripboard-user'] ?? headers['X-Tripboard-User'];
  const name = headers['x-tripboard-name'] ?? headers['X-Tripboard-Name'];
  if (userId) return { userId, name: name ? decodeURIComponent(name) : 'Member' };
  return null;
}

function stripApiPrefix(rawPath: string): string {
  const path = rawPath.replace(/^\/+/, '/');
  return path.startsWith('/api/') ? path.slice(4) : path === '/api' ? '/' : path;
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method;
  const path = stripApiPrefix(event.rawPath);

  // Reject anything that didn't come through CloudFront (no/!matching edge secret).
  const edgeHeaders = event.headers ?? {};
  if (!edgeSecretOk(edgeHeaders['x-edge-secret'] ?? edgeHeaders['X-Edge-Secret'], EDGE_SECRET)) {
    return respond(403, { error: { code: 'FORBIDDEN', message: 'direct API access is not allowed' } });
  }

  let body: unknown = undefined;
  if (event.body) {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      return respond(400, { error: { code: 'BAD_JSON', message: 'request body is not valid JSON' } });
    }
  }

  const req: ApiRequest = {
    method,
    path,
    query: event.queryStringParameters ?? {},
    body,
    identity: resolveIdentity(event),
  };

  const result = await handleRequest(repo, req);
  return respond(result.statusCode, result.body);
};

function respond(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  if (body === null || statusCode === 204) {
    return { statusCode, headers: { 'content-type': 'application/json' }, body: '' };
  }
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}
