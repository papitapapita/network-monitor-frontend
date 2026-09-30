import type { Page, Route } from '@playwright/test';
import { E2E } from '../../playwright.config';

/**
 * Probe agents cannot be deleted, a revoked agent's name is never free again,
 * and while exactly one agent exists every new device silently goes behind it
 * (DEV-166). A spec that created real agents would change how the rest of the
 * suite — and the install — behaves, so agent endpoints are answered here.
 */

const now = Date.now();
export const iso = (ms: number) => new Date(ms).toISOString();

export type FakeAgent = Record<string, unknown> & { id: string; name: string; status: string };

export function fakeAgent(over: Partial<FakeAgent> & { id: string; name: string }): FakeAgent {
  return {
    status: 'ACTIVE',
    pairingExpiresAt: null,
    enrolledAt: iso(now - 5 * 86_400_000),
    revokedAt: null,
    lastSeenAt: iso(now - 10_000),
    agentVersion: '0.1.0',
    clockOffsetMs: 40,
    offlineSince: null,
    clockDriftSince: null,
    deviceCount: 0,
    createdAt: iso(now - 10 * 86_400_000),
    updatedAt: iso(now),
    ...over,
  };
}

const json = (route: Route, data: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

const api = (path: string) => new RegExp(`${E2E.apiURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${path}`);

/**
 * Answers every agent route from `agents` (mutated in place, so a test can
 * change an agent between reads). Creating one adds a PENDING agent and hands
 * back a pairing key; `pairAfterReads` turns it ACTIVE after that many reads,
 * standing in for the installer on the customer's PC.
 */
export async function stubAgents(page: Page, agents: FakeAgent[], opts: { pairAfterReads?: number } = {}) {
  let reads = 0;
  await page.route(api('/agents(/[^?]*)?(\\?.*)?$'), (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^.*\/api/, '');

    if (req.method() === 'POST' && path === '/agents') {
      const { name } = req.postDataJSON();
      const agent = fakeAgent({
        id: `e2e-agent-${agents.length + 1}`, name, status: 'PENDING', pairingExpiresAt: iso(Date.now() + 86_400_000),
        enrolledAt: null, lastSeenAt: null, agentVersion: null, clockOffsetMs: null, createdAt: iso(Date.now()),
      });
      agents.push(agent);
      return json(route, { agent, pairingKey: 'pk1.aHR0cHM6Ly9hcGkuZXhhbXBsZS5jb20.e2e-pairing-code' }, 201);
    }
    if (path === '/agents') return json(route, { agents });

    const outages = path.match(/^\/agents\/([^/]+)\/outages$/);
    if (outages) return json(route, { outages: [], total: 0, limit: 20, offset: 0, hasMore: false });

    const one = path.match(/^\/agents\/([^/]+)$/);
    const agent = one && agents.find((a) => a.id === one[1]);
    if (!agent) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Agent not found' }) });
    if (agent.status === 'PENDING' && opts.pairAfterReads !== undefined && ++reads >= opts.pairAfterReads) {
      Object.assign(agent, { status: 'ACTIVE', pairingExpiresAt: null, enrolledAt: iso(Date.now()), lastSeenAt: iso(Date.now()), agentVersion: '0.1.0', clockOffsetMs: 40 });
    }
    return json(route, agent);
  });
}

/** Overrides fields of GET /api/installation, keeping the real answer's other fields. */
export async function patchInstallation(page: Page, patch: (data: Record<string, any>) => void) {
  await page.route(api('/installation$'), async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    patch(body.data);
    return route.fulfill({ response: res, json: body });
  });
}
