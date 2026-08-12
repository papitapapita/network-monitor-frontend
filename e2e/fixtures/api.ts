import { APIRequestContext, APIResponse, request as playwrightRequest } from '@playwright/test';
import { readFileSync } from 'fs';
import { E2E } from '../../playwright.config';

/** Resources the cleanup helper knows how to delete. */
export type Resource =
  | 'devices'
  | 'locations'
  | 'vendors'
  | 'device-models'
  | 'customers'
  | 'service-plans'
  | 'contracted-services'
  | 'tickets'
  | 'technicians';

/**
 * Pulls the JWT out of the session saved by auth.setup.ts, so talking to the
 * backend directly costs no extra login.
 */
function tokenFromStorageState(): string {
  const state = JSON.parse(readFileSync(E2E.storageState, 'utf-8'));
  const origin = state.origins?.find((o: { origin: string }) => o.origin === E2E.baseURL);
  const token = origin?.localStorage?.find((e: { name: string }) => e.name === 'nms_token')?.value;
  if (!token) {
    throw new Error(`No nms_token in ${E2E.storageState}. Did the setup project run?`);
  }
  return token;
}

/**
 * Thin client for talking to the backend *around* the UI.
 *
 * Use it to arrange preconditions (a device that must already exist) and to
 * tear down afterwards. Never use it to assert the thing the test is
 * exercising — that has to go through the browser, or you are not testing
 * the UI.
 */
export class ApiClient {
  /** Created resources, newest first, deleted in reverse on teardown. */
  private trash: Array<{ resource: Resource; id: string }> = [];

  constructor(private ctx: APIRequestContext) {}

  static async create(): Promise<ApiClient> {
    const ctx = await playwrightRequest.newContext({
      extraHTTPHeaders: {
        Authorization: `Bearer ${tokenFromStorageState()}`,
        'Content-Type': 'application/json',
      },
    });
    return new ApiClient(ctx);
  }

  /**
   * Deliberately not Playwright's `baseURL`: that resolves with `new URL()`
   * semantics, so a leading-slash path silently drops the `/api` prefix and
   * the request lands on a non-existent route.
   */
  private url(path: string): string {
    return `${E2E.apiURL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }

  /**
   * The backend wraps some responses in `{ success, data }` and returns others
   * bare. Normalise both, same as src/services/api.service.ts does.
   */
  private static unwrap<T>(body: unknown): T {
    if (body !== null && typeof body === 'object' && 'success' in body) {
      const wrapped = body as { success: boolean; data?: T; error?: string };
      if (!wrapped.success) throw new Error(wrapped.error ?? 'API returned success: false');
      return wrapped.data as T;
    }
    return body as T;
  }

  /**
   * Retries through the backend's rate limiter.
   *
   * A full suite run makes enough writes to trip it, and a 429'd cleanup
   * silently leaks records into the database — so every call goes through
   * here rather than only the ones that happened to fail first.
   */
  private async send(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    data?: unknown
  ): Promise<APIResponse> {
    const maxAttempts = 5;
    let res!: APIResponse;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      res = await this.ctx[method](url, data === undefined ? undefined : { data });
      if (res.status() !== 429) return res;

      // Honour Retry-After when the server sends it, else back off.
      const retryAfter = Number(res.headers()['retry-after']);
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(2000 * attempt, 8000);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    return res;
  }

  async get<T>(path: string): Promise<T> {
    const res = await this.send('get', this.url(path));
    if (!res.ok()) throw new Error(`GET ${path} → ${res.status()} ${await res.text()}`);
    return ApiClient.unwrap<T>(await res.json());
  }

  /**
   * PUT to an arbitrary path. Used for sub-resources that hang off a record
   * (device credentials, for one) and disappear with their parent, so there is
   * nothing extra to track for cleanup.
   */
  async put<T>(path: string, data: unknown): Promise<T> {
    const res = await this.send('put', this.url(path), data);
    if (!res.ok()) throw new Error(`PUT ${path} → ${res.status()} ${await res.text()}`);
    return ApiClient.unwrap<T>(await res.json());
  }

  /**
   * POST to an arbitrary path. Like `put`, this is for sub-resources that live
   * and die with their parent (a device's wireless config, for one), so there
   * is nothing extra to track for cleanup.
   */
  async post<T>(path: string, data: unknown): Promise<T> {
    const res = await this.send('post', this.url(path), data);
    if (!res.ok()) throw new Error(`POST ${path} → ${res.status()} ${await res.text()}`);
    return ApiClient.unwrap<T>(await res.json());
  }

  /**
   * Creates a record and registers it for automatic deletion after the test,
   * so a failing assertion still cleans up after itself.
   */
  async create<T extends { id: string }>(resource: Resource, data: unknown): Promise<T> {
    const res = await this.send('post', this.url(resource), data);
    if (!res.ok()) {
      throw new Error(`POST /${resource} → ${res.status()} ${await res.text()}`);
    }
    const created = ApiClient.unwrap<T>(await res.json());
    this.track(resource, created.id);
    return created;
  }

  /**
   * Registers an existing record for deletion. Use this for anything the test
   * created *through the UI* — the API client never saw it, so it cannot know
   * to clean it up otherwise.
   */
  track(resource: Resource, id: string): void {
    this.trash.unshift({ resource, id });
  }

  /** Forgets a record — call this when the test itself deleted it. */
  untrack(resource: Resource, id: string): void {
    this.trash = this.trash.filter((t) => !(t.resource === resource && t.id === id));
  }

  /**
   * Deletes a record mid-test and stops tracking it. Use it when the record
   * *ceasing to exist* is the precondition — a page holding a stale id, say —
   * rather than when the test is done with it.
   *
   * For devices that means a purge on top of the delete, since a plain delete
   * only tombstones the row and the record has to actually be gone.
   */
  async remove(resource: Resource, id: string): Promise<void> {
    const res = await this.send('delete', this.url(`${resource}/${id}`));
    if (!res.ok()) throw new Error(`DELETE /${resource}/${id} → ${res.status()} ${await res.text()}`);
    if (resource === 'devices') {
      const purged = await this.send('delete', this.url(`devices/${id}/purge`));
      if (!purged.ok()) {
        throw new Error(`DELETE /devices/${id}/purge → ${purged.status()} ${await purged.text()}`);
      }
    }
    this.untrack(resource, id);
  }

  /**
   * Deletes everything tracked, newest first so children go before parents.
   * Failures are reported but never thrown: cleanup must not turn a passing
   * test red, and a 404 just means the test already deleted it.
   *
   * Deleting a device only starts its 7-day grace period, so cleanup follows up
   * with a purge — otherwise every run leaves its fixtures piling up in the
   * recycle bin, where the bin's own specs would then trip over them.
   */
  async cleanup(): Promise<void> {
    for (const { resource, id } of this.trash) {
      try {
        const res = await this.send('delete', this.url(`${resource}/${id}`));
        if (!res.ok() && res.status() !== 404) {
          console.warn(`[e2e cleanup] DELETE /${resource}/${id} → ${res.status()}`);
        }
        // A 404 means the test already deleted it — through the UI, most
        // likely — so it is sitting in the bin and still needs purging.
        if (resource === 'devices' && (res.ok() || res.status() === 404)) {
          const purged = await this.send('delete', this.url(`devices/${id}/purge`));
          if (!purged.ok() && purged.status() !== 404) {
            console.warn(`[e2e cleanup] DELETE /devices/${id}/purge → ${purged.status()}`);
          }
        }
      } catch (err) {
        console.warn(`[e2e cleanup] DELETE /${resource}/${id} failed:`, err);
      }
    }
    this.trash = [];
    await this.ctx.dispose();
  }
}

/**
 * Builds a name that is unique per run and obviously test-generated, so
 * anything that escapes cleanup is easy to spot and bulk-delete later.
 */
export function uniqueName(prefix: string): string {
  return `e2e-${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}
