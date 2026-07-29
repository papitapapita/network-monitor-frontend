import { test as base, expect } from '@playwright/test';
import { ApiClient } from './api';

/**
 * Use this `test` instead of the one from @playwright/test.
 *
 *   import { test, expect } from './fixtures/test';
 *
 *   test('creates a device', async ({ page, api }) => {
 *     const name = uniqueName('device');
 *     // ...drive the UI to create it...
 *     api.track('devices', deviceId);   // so it gets deleted afterwards
 *   });
 *
 * The `api` fixture talks to the backend directly for setup and teardown, and
 * deletes everything it knows about once the test finishes — pass or fail.
 */
export const test = base.extend<{ api: ApiClient }>({
  api: async ({}, use) => {
    const api = await ApiClient.create();
    await use(api);
    await api.cleanup();
  },
});

export { expect };
export { uniqueName } from './api';
