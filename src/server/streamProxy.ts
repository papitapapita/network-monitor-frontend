/**
 * Relays one of the backend's event streams to the browser.
 *
 * Every other `/api` request goes through the `rewrites()` proxy in
 * `next.config.ts`, but that proxy keeps the backend connection open after the
 * browser has gone: a closed tab went on holding one of the user's 5 stream
 * slots for about a minute, and two live pages refreshed in a row were enough
 * to be refused "Too many streams". Here the backend request is tied to the
 * browser's own — when the browser disconnects, `request.signal` aborts, and
 * the abort closes the backend socket, which frees the slot at once.
 */

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:3000';

/** Hop-by-hop, or describing the browser's connection rather than the request. */
const DROPPED_REQUEST_HEADERS = ['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'content-length'];

/** Passed back as they come; a stream's answer has nothing else worth keeping. */
const KEPT_RESPONSE_HEADERS = ['content-type', 'cache-control', 'retry-after'];

export async function proxyStream(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  for (const name of DROPPED_REQUEST_HEADERS) headers.delete(name);
  // What the rewrite proxy sends too: the backend logs and rate-limits by it.
  headers.set('x-forwarded-host', url.host);
  headers.set('x-forwarded-proto', url.protocol.replace(':', ''));

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL}${url.pathname}${url.search}`, {
      headers,
      signal: request.signal,
      cache: 'no-store',
    });
  } catch {
    // The browser left before the backend answered, or the backend is down.
    // Either way a plain JSON error, as the backend's own failures are.
    return Response.json({ error: 'Backend unreachable' }, { status: 502 });
  }

  const out = new Headers();
  for (const name of KEPT_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  // Without this a buffering proxy in front of us would hold frames back.
  out.set('x-accel-buffering', 'no');

  return new Response(upstream.body, { status: upstream.status, headers: out });
}
