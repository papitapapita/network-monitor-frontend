import dagre from '@dagrejs/dagre';
import type { TopologyNodeDTO } from '@/types/topology.types';

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 70;

/** A node with more children than this starts folded, unless the fault is somewhere below it. */
const FOLD_ABOVE_CHILDREN = 8;

export interface TopologyIndex {
  byId: Map<string, TopologyNodeDTO>;
  children: Map<string, TopologyNodeDTO[]>;
  /** Roots with something below them — the trees worth drawing. */
  roots: TopologyNodeDTO[];
  /** Roots with nothing below them: devices nobody has linked yet. */
  unlinked: TopologyNodeDTO[];
}

export function indexTopology(nodes: TopologyNodeDTO[]): TopologyIndex {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, TopologyNodeDTO[]>();
  for (const n of nodes) {
    if (!n.upstreamDeviceId) continue;
    const list = children.get(n.upstreamDeviceId) ?? [];
    list.push(n);
    children.set(n.upstreamDeviceId, list);
  }
  const roots = nodes.filter((n) => !n.upstreamDeviceId);
  return {
    byId,
    children,
    roots: roots.filter((n) => children.has(n.id)),
    unlinked: roots.filter((n) => !children.has(n.id)),
  };
}

/** Every device above `id`, nearest first. */
export function ancestorsOf(index: TopologyIndex, id: string): string[] {
  const out: string[] = [];
  for (let at = index.byId.get(id)?.upstreamDeviceId; at; at = index.byId.get(at)?.upstreamDeviceId) out.push(at);
  return out;
}

/** Every device below `id`, breadth-first. */
export function descendantsOf(index: TopologyIndex, id: string): TopologyNodeDTO[] {
  const out: TopologyNodeDTO[] = [];
  const queue = [...(index.children.get(id) ?? [])];
  while (queue.length) {
    const n = queue.shift()!;
    out.push(n);
    queue.push(...(index.children.get(n.id) ?? []));
  }
  return out;
}

/** How long ago `iso` was, e.g. "hace 5 min", or null when there is no time. */
export function sinceLabel(iso: string | null): string | null {
  if (!iso) return null;
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `hace ${hours} h` : `hace ${Math.round(hours / 24)} d`;
}

export interface HiddenSummary {
  total: number;
  down: number;
  unreachable: number;
}

export function summarise(nodes: TopologyNodeDTO[]): HiddenSummary {
  return {
    total: nodes.length,
    down: nodes.filter((n) => n.reachability === 'DOWN').length,
    unreachable: nodes.filter((n) => n.reachability === 'UNREACHABLE').length,
  };
}

/**
 * The nodes folded when the map opens: the busy ones (an AP with its CPEs),
 * except above a DOWN device that has devices of its own — an AP or switch
 * fault is what the operator came to see. A single customer's CPE down stays
 * folded, counted in red on its AP; UNREACHABLE devices are the symptom.
 */
export function initialFolds(index: TopologyIndex): Set<string> {
  const folded = new Set<string>();
  for (const [id, kids] of index.children) {
    if (kids.length <= FOLD_ABOVE_CHILDREN) continue;
    if (descendantsOf(index, id).some((n) => n.reachability === 'DOWN' && index.children.has(n.id))) continue;
    folded.add(id);
  }
  return folded;
}

/**
 * The devices to draw: the linked trees, minus what hangs below a folded
 * node, narrowed by `keep` when a filter is on — a kept device brings its
 * ancestors along, so it is never drawn detached from the path to the root.
 */
export function visibleNodes(index: TopologyIndex, folded: Set<string>, keep: ((n: TopologyNodeDTO) => boolean) | null): TopologyNodeDTO[] {
  let allowed: Set<string> | null = null;
  if (keep) {
    allowed = new Set();
    for (const n of index.byId.values()) {
      if (!keep(n)) continue;
      allowed.add(n.id);
      for (const a of ancestorsOf(index, n.id)) allowed.add(a);
    }
  }
  const out: TopologyNodeDTO[] = [];
  const walk = (n: TopologyNodeDTO) => {
    if (allowed && !allowed.has(n.id)) return;
    out.push(n);
    if (folded.has(n.id)) return;
    for (const c of index.children.get(n.id) ?? []) walk(c);
  };
  // A filter can match an unlinked device too; it is drawn alone then.
  for (const r of allowed ? [...index.roots, ...index.unlinked] : index.roots) walk(r);
  return out;
}

/** Left to right: an AP's hundred CPEs stack down the page instead of across it. */
export function layout(nodes: TopologyNodeDTO[]): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 14, ranksep: 70, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  const ids = new Set(nodes.map((n) => n.id));
  for (const n of nodes) g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const n of nodes) if (n.upstreamDeviceId && ids.has(n.upstreamDeviceId)) g.setEdge(n.upstreamDeviceId, n.id);
  dagre.layout(g);
  const out = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const p = g.node(n.id);
    // dagre gives the centre; React Flow places by the top-left corner.
    out.set(n.id, { x: p.x - NODE_WIDTH / 2, y: p.y - NODE_HEIGHT / 2 });
  }
  return out;
}
