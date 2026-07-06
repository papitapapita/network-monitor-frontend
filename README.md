# Network Monitor — Frontend

The web console for a Colombian WISP-style network management system: inventory,
map, monitor, and troubleshoot every device, location, and customer service on
the network from one place.

## What problem it solves

Small/medium internet providers and network operators typically track their
infrastructure across spreadsheets, router configs, and tribal knowledge. This
app gives them a single system of record and a live operational view instead:

- **Inventory** — devices, device models, and vendors, each with a
  lifecycle (`INVENTORY → COMMISSIONING → ACTIVE`, or `DAMAGED`) instead of a
  single boolean "active" flag.
- **Where things are** — locations (towers, datacenters, POPs, offices,
  customer premises) with GPS coordinates, rendered on an interactive map.
- **Is it up?** — per-device polling (manual trigger or scheduled config),
  connectivity status (`ONLINE` / `OFFLINE` / `UNKNOWN`), and history/stats.
- **Wireless-specific monitoring** — signal, clients, and alerts for
  AP/CPE-class devices, layered on top of the generic polling model.
- **Alerts** — a unified feed of warnings/critical events raised by polling
  and wireless monitoring, filterable by severity/status.
- **Discovery** — scan a CIDR range to find live hosts on the network and
  fast-path them into inventory as new devices.
- **Billing-adjacent data** — customers, service plans, and the contracted
  services that link a customer to a plan and (optionally) a device.

The frontend's job is to make all of that legible and safe to operate:
role-aware forms, client-side validation matching backend constraints, and
consistent list/detail/edit flows across every resource type.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | [Next.js](https://nextjs.org) 16 (App Router), React 19 |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4, dark mode via a `.dark` class toggle |
| Server state | [TanStack Query](https://tanstack.com/query) (`useQuery`, cache keys per filter/page) |
| Client state | React Context (`auth.context`, `settings.context`) + local component state |
| Maps | Leaflet / react-leaflet |
| HTTP | A single `ApiService` singleton wrapping `fetch`, no separate HTTP lib |
| Auth | JWT stored in `localStorage`, attached as a `Bearer` header |

There is no WebSocket layer despite what an older revision of this README
claimed — "real-time" status comes from polling the backend (manually or on
a schedule), not a push channel.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  app/**/page.tsx           (routes, mostly 'use client') │
│    → src/hooks/*           (data-fetching + query state) │
│    → src/components/**     (page-specific + shared UI)   │
│         → src/services/api.service.ts (HTTP + auth token)│
│         → src/types/*.types.ts        (DTOs, mirror API) │
└─────────────────────────────────────────────────────────┘
```

- **`ApiService`** (`src/services/api.service.ts`) is the only thing that
  talks HTTP. It holds the JWT in memory, sets the `Authorization` header,
  and normalizes every response to `{ success, data?, error? }`. A handful
  of endpoints (credentials, polling, wireless) return raw payloads instead
  of the envelope — the service accounts for that per-call.
  A `401` dispatches a `window` event (`nms:unauthorized`) that `AppShell`
  listens for to force a logout, instead of threading a callback through
  every call site.
- **Mock mode**: setting `NEXT_PUBLIC_USE_MOCK=true` swaps the real
  `ApiService` for `mock-api.service.ts` at the module boundary
  (`export const apiService = USE_MOCK ? mockApiService : new ApiService()`),
  so pages never know the difference. Useful for working on UI without a
  running backend.
- **Auth** (`src/contexts/auth.context.tsx`) persists `{ token, user }` in
  `localStorage`, restores it on mount, and exposes `login`/`logout`.
  `AppShell` (`src/components/layout/AppShell.tsx`) is the route guard: it
  redirects unauthenticated users to `/login` and renders nothing else while
  auth state is resolving.
- **Data fetching** is TanStack Query per-page (see `src/hooks/useDevices.ts`,
  `useDashboardData.ts`); most other pages fetch directly in a `useEffect` +
  local state, so the codebase isn't fully migrated to one pattern — new
  list/detail pages should prefer the Query-hook style.
- **Types mirror the backend DTOs** in `src/types/*.types.ts`. `BACKEND_API.md`
  at the repo root is the source of truth for request/response shapes, enums,
  auth rules, and rate limits — read it before changing anything that touches
  the API.
- **Routing** follows the resource nav 1:1: `devices`, `device-models`,
  `vendors`, `locations`, `map`, `alerts`, `customers`, `service-plans`,
  `network-scan`, `settings`, plus `login`. Each list route typically has a
  sibling `create/` and `[id]/` route.

## Engineering notes

- **This README supersedes older claims.** A previous version described a
  DRAFT/ACTIVE device lifecycle with soft-delete/restore and WebSocket
  events — that no longer matches the code. Current lifecycle is
  `INVENTORY / COMMISSIONING / ACTIVE / DAMAGED` (see
  `src/constants/device.constants.ts` and `BACKEND_API.md`). Trust the code
  and `BACKEND_API.md` over prose in this file if they ever diverge again.
- **Roles are enforced server-side**, not just hidden in the UI:
  `ADMIN` > `OPERATOR` > `VIEWER`. The frontend should still hide/disable
  actions a role can't perform, but never rely on that alone for security.
- **UI copy is in Spanish** (`lang="es"` in the root layout, labels like
  "Dispositivos", "Ubicaciones"). Keep new user-facing strings consistent
  with that, even though code/comments/identifiers stay in English.
- **Client-side validation should mirror backend constraints** (IP/MAC
  regex, string length caps, wireless-only categories) rather than
  reinventing them — see `src/constants/device.constants.ts` for the
  existing helpers (`isValidIpAddress`, `isValidMacAddress`,
  `isWirelessCategory`) before adding new ones.
- **`e2e/`** currently holds an ad-hoc Playwright script (not wired into
  `package.json` scripts or CI) used to sanity-check the map view. Treat it
  as a debugging aid, not a maintained test suite.
- **Dev server runs on port 3001** (`next dev -p 3001`) so it can sit next to
  a backend on `3000` without colliding; `next.config.ts` also proxies
  `/api/*` to `http://localhost:3000/api/*` via rewrites.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables:
   ```bash
   cp .env.example .env.local
   ```
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:3000/api
   NEXT_PUBLIC_WS_URL=ws://localhost:3000   # unused by current code, kept for parity with backend config
   # NEXT_PUBLIC_USE_MOCK=true              # optional: run against mock-api.service.ts, no backend needed
   ```
3. Start the backend + database (see the [root README](../README.md)), or set
   `NEXT_PUBLIC_USE_MOCK=true` to run the UI standalone.
4. Run the dev server:
   ```bash
   npm run dev
   ```
5. Open http://localhost:3001

### Other scripts

```bash
npm run build   # production build
npm start       # serve the production build (port 3001)
npm run lint    # ESLint
```

## Project structure

```
frontend/
├── app/                          # Next.js App Router — one folder per resource
│   ├── devices/                  # list, create/, [id]/
│   ├── device-models/
│   ├── vendors/
│   ├── locations/
│   ├── map/                      # Leaflet map of all locations
│   ├── alerts/                   # unified polling/wireless alert feed
│   ├── customers/
│   ├── service-plans/
│   ├── network-scan/             # CIDR scan → discovered hosts → create device
│   ├── settings/
│   ├── login/
│   └── layout.tsx                # QueryProvider → AuthProvider → SettingsProvider → AppShell
├── src/
│   ├── components/
│   │   ├── ui/                   # Button, Table, Modal, Select, Combobox, ...
│   │   ├── layout/                # AppShell (route guard), Sidebar, QueryProvider
│   │   ├── devices/, device-models/, locations/, map/  # feature-specific components
│   ├── services/
│   │   ├── api.service.ts        # HTTP client + auth token + mock/real switch
│   │   ├── mock-api.service.ts   # in-memory backend for NEXT_PUBLIC_USE_MOCK
│   │   └── mock.data.ts
│   ├── contexts/                 # auth.context.tsx, settings.context.tsx (theme)
│   ├── hooks/                    # useDevices.ts, useDashboardData.ts (TanStack Query)
│   ├── constants/                # validation regex + option lists per resource
│   └── types/                    # *.types.ts — mirrors backend DTOs 1:1
├── e2e/                          # ad-hoc Playwright script (not a real suite, see notes)
├── BACKEND_API.md                # source of truth for the API contract
└── Dockerfile
```

## Learn more

- [`BACKEND_API.md`](./BACKEND_API.md) — full API reference (endpoints, DTOs, enums, auth, rate limits)
- [Root README](../README.md) — running the full stack (backend + database)
- [Next.js documentation](https://nextjs.org/docs)
- [TanStack Query documentation](https://tanstack.com/query/latest)
