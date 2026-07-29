/**
 * Deletes leftover `e2e-` records from the backend.
 *
 * Cleanup normally runs per test, but a crashed run (or a rate-limited
 * teardown) can still strand rows. Run with:
 *
 *   npm run e2e:sweep
 *
 * Order matters: devices reference models and locations, models reference
 * vendors, so children must be deleted first. `track()` unshifts, so this
 * list runs parents-first in order to have children come out first.
 */
import { ApiClient } from './api';

type Listing = { path: string; key: string; resource: Parameters<ApiClient['track']>[0] };

const LISTINGS: Listing[] = [
  { path: '/vendors?limit=100', key: 'vendors', resource: 'vendors' },
  { path: '/locations?limit=100', key: 'locations', resource: 'locations' },
  { path: '/device-models?limit=100', key: 'deviceModels', resource: 'device-models' },
  { path: '/devices?limit=100', key: 'devices', resource: 'devices' },
];

async function main() {
  const api = await ApiClient.create();
  let total = 0;

  for (const { path, key, resource } of LISTINGS) {
    const body = await api.get<Record<string, Array<{ id: string; name?: string; model?: string }>>>(path);
    const rows = body[key] ?? [];
    const strays = rows.filter((r) => (r.name ?? r.model ?? '').startsWith('e2e-'));

    for (const row of strays) api.track(resource, row.id);
    total += strays.length;
    console.log(`${resource}: ${strays.length} stray${strays.length === 1 ? '' : 's'}`);
  }

  await api.cleanup();
  console.log(total === 0 ? 'Nothing to sweep.' : `Swept ${total} record(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
