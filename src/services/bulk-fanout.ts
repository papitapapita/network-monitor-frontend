import { ApiResponse } from '../types/common.types';

/**
 * Runs one request per id, a few at a time, staying inside the backend's
 * per-user budget for the verb.
 *
 * Every endpoint a selection bar fans out over — deleting devices, restoring
 * them, polling them, resolving tickets — is capped at 60/min for the user
 * (`BACKEND_API.md`), so they all want the same pacing and none of them wants
 * its own copy of it.
 *
 * The naive `Promise.all(ids.map(runOne))` fires the whole selection at once,
 * so any selection larger than the budget is *guaranteed* to half-finish: the
 * first N land and the rest come back 429. Worse, rejected requests still
 * count against the bucket, so an immediate manual retry keeps it pinned and
 * the operator concludes the app is broken.
 *
 * Two defences, because the client cannot see the server's counter:
 *  - self-pacing, which keeps a normal run from ever tripping the limit, and
 *  - a backoff-and-resume on 429, for when something else already spent the
 *    budget (another tab, a second operator behind the same IP, a run that was
 *    interrupted mid-window).
 */

/** Requests in flight at once. Enough to keep a batch brisk, far below any burst limit. */
const CONCURRENCY = 4;

/**
 * Requests we allow ourselves per minute. The backend's per-user budget is
 * 60/min for writes and the same for deletes, each resource counted separately
 * (`BACKEND_API.md`); the margin absorbs the drift between our window and its.
 */
const REQUESTS_PER_MINUTE = 55;
const WINDOW_MS = 60_000;

/**
 * Waits after a 429, in ms. The bucket refills over a minute, so the second
 * attempt clears any window we could have walked into partway through.
 */
const RETRY_DELAYS_MS = [20_000, 65_000];

export interface BulkFanOutProgress {
  done: number;
  total: number;
  /** Epoch ms the paused run resumes at — set only while waiting out a 429. */
  retryAt: number | null;
}

export interface BulkFanOutOutcome {
  /** Ids that went through, in completion order — for a delete, the set an undo has to put back. */
  succeededIds: string[];
  /**
   * `binnedDeviceCount` passes through the same field on `ApiResponse` — set
   * only on a refusal a caller can turn into a confirm-and-retry (DEV-030)
   * instead of a dead-end failure.
   */
  failed: Array<{ id: string; error: string; binnedDeviceCount?: number }>;
  /** Ids abandoned because the rate limit never cleared, a subset of `failed`. */
  rateLimited: string[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Sliding-window pacer: never lets more than `REQUESTS_PER_MINUTE` starts fall inside any 60s span. */
function createPacer() {
  const starts: number[] = [];
  return async function acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();
      while (starts.length > 0 && now - starts[0] >= WINDOW_MS) starts.shift();
      if (starts.length < REQUESTS_PER_MINUTE) {
        starts.push(now);
        return;
      }
      await sleep(starts[0] + WINDOW_MS - now + 50);
    }
  };
}

/**
 * `runOne` is only ever called for its success flag, so any single-row call
 * fits: a restore answering with the row it brought back, or a poll answering
 * with a latency, are both handed over unchanged.
 */
export async function runBulkFanOut(
  ids: string[],
  runOne: (id: string) => Promise<ApiResponse<unknown>>,
  onProgress?: (progress: BulkFanOutProgress) => void
): Promise<BulkFanOutOutcome> {
  const total = ids.length;
  const acquire = createPacer();
  const failed: Array<{ id: string; error: string; binnedDeviceCount?: number }> = [];
  const succeededIds: string[] = [];

  const report = (retryAt: number | null = null) =>
    onProgress?.({ done: succeededIds.length + failed.length, total, retryAt });

  let pending = ids;

  for (let round = 0; ; round++) {
    let cursor = 0;
    let throttled = false;
    const deferred: string[] = [];
    const batch = pending;

    const worker = async () => {
      while (!throttled) {
        const index = cursor++;
        if (index >= batch.length) return;
        const id = batch[index];

        await acquire();
        // Another worker hit the limit while this one waited for its slot.
        if (throttled) {
          deferred.push(id);
          return;
        }
        const result = await runOne(id);

        if (result.success) {
          succeededIds.push(id);
          report();
          continue;
        }
        // A 429 means the budget is gone; stop the pool rather than spend the
        // remaining ids on requests that will be rejected — and counted — anyway.
        if (result.status === 429) {
          throttled = true;
          deferred.push(id);
          return;
        }
        failed.push({ id, error: result.error ?? 'Error desconocido', binnedDeviceCount: result.binnedDeviceCount });
        report();
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, batch.length) }, worker)
    );
    // Ids the stopped pool never reached. Every id it did pull is already
    // accounted for by the worker that pulled it.
    if (throttled) deferred.push(...batch.slice(Math.min(cursor, batch.length)));

    if (deferred.length === 0) break;

    if (round >= RETRY_DELAYS_MS.length) {
      const error = 'Demasiadas solicitudes. Espera un minuto e inténtalo de nuevo.';
      deferred.forEach((id) => failed.push({ id, error }));
      report();
      return { succeededIds, failed, rateLimited: deferred };
    }

    const retryAt = Date.now() + RETRY_DELAYS_MS[round];
    report(retryAt);
    // Tick so a countdown can move; the run is otherwise idle here.
    while (Date.now() < retryAt) {
      await sleep(Math.min(1000, retryAt - Date.now()));
      report(retryAt);
    }
    report();
    pending = deferred;
  }

  return { succeededIds, failed, rateLimited: [] };
}
