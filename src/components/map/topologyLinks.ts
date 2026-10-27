import type { MapPin } from '@/types/map.types';
import type { TopologyNodeDTO, TopologyReachability } from '@/types/topology.types';
import { indexTopology, type TopologyIndex } from '@/components/topology/topologyTree';

/** One upstream link, coloured by the child end: that is where a fault shows. */
export interface MapLink {
  child: TopologyNodeDTO;
  upstream: TopologyNodeDTO;
}

/**
 * Every link between the same two pins, drawn as one line — stacked lines
 * would hide a red one under a green one. It takes the worst child state.
 */
export interface LinkLine {
  key: string;
  from: MapPin;
  to: MapPin;
  links: MapLink[];
  reachability: TopologyReachability;
  /** Some link here has its child at `to`, so it points back toward `from`. */
  backward: boolean;
}

/** A link that has no line: one end has no location, or its location no coordinates. */
export interface OffMapLink extends MapLink {
  reason: string;
}

export interface MapTopology {
  index: TopologyIndex;
  /** Worst last, so a red line is drawn over the green ones it crosses. */
  lines: LinkLine[];
  offMap: OffMapLink[];
  byLocation: Map<string, TopologyNodeDTO[]>;
}

const SEVERITY: Record<TopologyReachability, number> = { UP: 0, UNKNOWN: 1, UNREACHABLE: 2, DOWN: 3 };

const worst = (a: TopologyReachability, b: TopologyReachability) => (SEVERITY[b] > SEVERITY[a] ? b : a);

/** Why `node`'s end of a link can't be placed, or null when its pin is on the map. */
function missingEnd(node: TopologyNodeDTO, pinsById: Map<string, MapPin>): string | null {
  if (!node.locationId) return `«${node.name}» no tiene ubicación`;
  if (!pinsById.has(node.locationId)) return `«${node.locationName ?? node.name}» no tiene coordenadas`;
  return null;
}

/** Joins the topology to the map pins on `node.locationId === pin.id`. */
export function mapTopology(pins: MapPin[], nodes: TopologyNodeDTO[]): MapTopology {
  const index = indexTopology(nodes);
  const pinsById = new Map(pins.map((p) => [p.id, p]));
  const byLocation = new Map<string, TopologyNodeDTO[]>();
  for (const n of nodes) {
    if (!n.locationId) continue;
    const list = byLocation.get(n.locationId) ?? [];
    list.push(n);
    byLocation.set(n.locationId, list);
  }

  const lines = new Map<string, LinkLine>();
  const offMap: OffMapLink[] = [];
  for (const child of nodes) {
    const upstream = child.upstreamDeviceId ? index.byId.get(child.upstreamDeviceId) : undefined;
    if (!upstream) continue;
    const reason = missingEnd(child, pinsById) ?? missingEnd(upstream, pinsById);
    if (reason) {
      offMap.push({ child, upstream, reason });
      continue;
    }
    // Same site: nothing to draw; the pin's popup says which depends on which.
    if (child.locationId === upstream.locationId) continue;
    const [a, b] = [child.locationId!, upstream.locationId!].sort();
    const key = `${a}|${b}`;
    const line = lines.get(key);
    if (line) {
      line.links.push({ child, upstream });
      line.reachability = worst(line.reachability, child.reachability);
      if (child.locationId === line.to.id) line.backward = true;
    } else {
      lines.set(key, {
        key,
        from: pinsById.get(child.locationId!)!,
        to: pinsById.get(upstream.locationId!)!,
        links: [{ child, upstream }],
        reachability: child.reachability,
        backward: false,
      });
    }
  }

  return {
    index,
    lines: [...lines.values()].sort((x, y) => SEVERITY[x.reachability] - SEVERITY[y.reachability]),
    offMap,
    byLocation,
  };
}

/**
 * A site takes the worst state among its devices, except that one answering
 * device outweighs others with no data: DOWN, then UNREACHABLE, then UP.
 * UNKNOWN when nothing there is monitored, or nothing on the network is there.
 */
export function pinReachability(nodes: TopologyNodeDTO[] | undefined): TopologyReachability {
  for (const r of ['DOWN', 'UNREACHABLE', 'UP'] as const) {
    if (nodes?.some((n) => n.reachability === r)) return r;
  }
  return 'UNKNOWN';
}
