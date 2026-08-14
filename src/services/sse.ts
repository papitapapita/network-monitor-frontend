/**
 * Minimal Server-Sent Events client built on `fetch`.
 *
 * `BACKEND_API.md` documents the throughput streams as `EventSource` endpoints
 * that take the JWT in the query string, because `EventSource` cannot set
 * headers. We read them with `fetch` instead, for two reasons:
 *
 *  - the token stays in the `Authorization` header, out of URLs, proxy logs and
 *    browser history;
 *  - the caller gets the status code behind a refusal. `EventSource` collapses
 *    "this device has never been polled" (404) and "you already hold 5 streams"
 *    (429) into one anonymous `onerror`, and those need different words.
 *
 * What we give up is `EventSource`'s built-in reconnect, so it is reimplemented
 * here — including honouring the server's `retry:` field.
 */

export type SseState =
  /** Opening the connection; no frame has arrived yet. */
  | { status: 'connecting' }
  | { status: 'live' }
  /** The link dropped mid-stream. A reconnect is already scheduled. */
  | { status: 'reconnecting'; error: string }
  /** Given up — nothing more happens until the caller opens a new stream. */
  | { status: 'error'; error: string; httpStatus?: number };

export interface SseOptions {
  /** Sent as `Authorization: Bearer`. Omitted when null, so the 401 path is exercised. */
  token?: string | null;
  /** `data` is the frame's payload with the `data: ` prefixes stripped and lines rejoined. */
  onEvent: (event: string, data: string) => void;
  onState?: (state: SseState) => void;
}

/**
 * Statuses where reconnecting would only replay the same refusal: a bad
 * request, an expired session, or a device that was never polled. Everything
 * else (5xx, a dropped socket) is worth retrying.
 */
const FATAL_STATUSES = new Set([400, 401, 403, 404]);

/**
 * The stream cap (5 per user) is usually transient — navigating between two
 * live views holds both slots until the old page's socket is reaped, and React
 * opens a second stream on every remount in development. So a 429 is retried a
 * few times before it becomes something the operator has to act on.
 */
const CAP_RETRIES = 3;
const CAP_RETRY_MS = 2_000;

/** Matches the `retry: 5000` the backend sends; replaced by it once seen. */
const DEFAULT_RETRY_MS = 5_000;
const MAX_RETRY_MS = 60_000;

/** SSE frame separator — a blank line, in any of the line endings the spec allows. */
const FRAME_END = /\r\n\r\n|\n\n|\r\r/;

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body && typeof body.error === 'string') return body.error;
    if (body && typeof body.message === 'string') return body.message;
  } catch {
    // The failure path is documented as plain JSON, but a proxy in the middle
    // can answer with HTML; the status is still worth reporting.
  }
  return `HTTP ${response.status}`;
}

/**
 * Opens `url` as an event stream and calls `onEvent` per frame. Returns the
 * closer — call it on unmount. The backend caps a user at 5 concurrent
 * streams, so a leaked one costs the operator a slot until the socket dies.
 */
export function openSseStream(url: string, options: SseOptions): () => void {
  let closed = false;
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let retryMs = DEFAULT_RETRY_MS;
  let attempt = 0;
  let capAttempt = 0;

  const setState = (state: SseState) => {
    if (!closed) options.onState?.(state);
  };

  const reconnect = (error: string, waitMs?: number) => {
    if (closed) return;
    // Back off on repeated failures — a server that is down stays down for
    // longer than one retry window, and a tight loop helps nobody.
    const wait = waitMs ?? Math.min(retryMs * 2 ** attempt, MAX_RETRY_MS);
    attempt += 1;
    setState({ status: 'reconnecting', error });
    timer = setTimeout(() => { void connect(); }, wait);
  };

  const dispatch = (frame: string) => {
    let event = 'message';
    const data: string[] = [];

    for (const rawLine of frame.split(/\r\n|\n|\r/)) {
      // `: ping` keep-alives are comments; they carry no payload.
      if (rawLine === '' || rawLine.startsWith(':')) continue;
      const colon = rawLine.indexOf(':');
      const field = colon === -1 ? rawLine : rawLine.slice(0, colon);
      let value = colon === -1 ? '' : rawLine.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);

      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
      else if (field === 'retry') {
        const ms = Number(value);
        if (Number.isFinite(ms) && ms > 0) retryMs = ms;
      }
    }

    if (data.length > 0 && !closed) options.onEvent(event, data.join('\n'));
  };

  async function connect(): Promise<void> {
    if (closed) return;
    controller = new AbortController();
    setState({ status: 'connecting' });

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: 'text/event-stream',
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
        cache: 'no-store',
        signal: controller.signal,
      });
    } catch {
      if (closed) return;
      reconnect('Sin conexión con el servidor');
      return;
    }

    if (!response.ok || !response.body) {
      const message = await readErrorMessage(response);
      if (FATAL_STATUSES.has(response.status)) {
        setState({ status: 'error', error: message, httpStatus: response.status });
        closed = true;
        return;
      }
      if (response.status === 429) {
        if (capAttempt >= CAP_RETRIES) {
          setState({ status: 'error', error: message, httpStatus: 429 });
          closed = true;
          return;
        }
        // Short, fixed waits: the slot we are waiting on is one another view is
        // in the middle of giving up, not a server that needs time to recover.
        reconnect(message, CAP_RETRY_MS * 2 ** capAttempt);
        capAttempt += 1;
        return;
      }
      reconnect(message);
      return;
    }

    attempt = 0;
    capAttempt = 0;
    setState({ status: 'live' });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let match: RegExpExecArray | null;
        while ((match = FRAME_END.exec(buffer)) !== null) {
          const frame = buffer.slice(0, match.index);
          buffer = buffer.slice(match.index + match[0].length);
          dispatch(frame);
        }
      }
    } catch {
      // An abort lands here too — `closed` tells the two apart.
    }

    if (closed) return;
    reconnect('Conexión interrumpida');
  }

  void connect();

  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    controller?.abort();
  };
}
