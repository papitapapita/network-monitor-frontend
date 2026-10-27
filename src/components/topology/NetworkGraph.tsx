'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useSettings } from '@/contexts/settings.context';
import { Badge, Combobox, Select, Switch } from '@/components/ui';
import { deviceCategoryLabel } from '@/constants/device.constants';
import { REACHABILITY } from '@/constants/topology.constants';
import type { TopologyNodeDTO } from '@/types/topology.types';
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  descendantsOf,
  ancestorsOf,
  indexTopology,
  initialFolds,
  layout,
  summarise,
  visibleNodes,
  type HiddenSummary,
} from './topologyTree';

type DeviceNodeData = {
  node: TopologyNodeDTO;
  /** Set while the node is folded: what is hidden below it. */
  hidden: HiddenSummary | null;
  childCount: number;
  selected: boolean;
  dimmed: boolean;
  onToggle: (id: string) => void;
};

type DeviceNode = Node<DeviceNodeData, 'device'>;

const sinceLabel = (iso: string | null): string | null => {
  if (!iso) return null;
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `hace ${hours} h` : `hace ${Math.round(hours / 24)} d`;
};

const BORDER: Record<TopologyNodeDTO['reachability'], string> = {
  UP: 'border-gray-300 dark:border-gray-600',
  DOWN: 'border-red-500 ring-2 ring-red-500/30',
  UNREACHABLE: 'border-dashed border-gray-400 dark:border-gray-500',
  UNKNOWN: 'border-gray-300 dark:border-gray-600',
};

const DeviceNodeCard = memo(function DeviceNodeCard({ data }: NodeProps<DeviceNode>) {
  const { node, hidden, childCount, selected, dimmed, onToggle } = data;
  const r = REACHABILITY[node.reachability];
  return (
    <div
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      className={`relative rounded-lg border bg-white dark:bg-gray-800 px-3 py-2 shadow-sm text-left transition-opacity ${BORDER[node.reachability]} ${
        selected ? 'outline-2 outline-offset-2 outline-brand-500' : ''
      } ${dimmed ? 'opacity-40' : ''} ${node.reachability === 'UNREACHABLE' ? 'bg-gray-50 dark:bg-gray-800/60' : ''}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-400 !border-0 !w-1.5 !h-1.5" isConnectable={false} />
      <div className="flex items-center gap-2 min-w-0">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.dot}`} title={r.label} />
        <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100" title={node.name}>
          {node.name}
        </span>
      </div>
      <p className="mt-0.5 font-mono text-xs text-gray-500 dark:text-gray-400 truncate">{node.ipAddress ?? 'sin IP'}</p>
      {(node.reachability === 'DOWN' || node.reachability === 'UNREACHABLE') && (
        <p className={`text-xs truncate ${node.reachability === 'DOWN' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
          {r.label} {sinceLabel(node.downSince)}
        </p>
      )}
      {childCount > 0 && (
        <button
          type="button"
          // A click on the node selects it; the toggle must not do that too.
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node.id);
          }}
          className={`nodrag absolute -right-3 top-1/2 -translate-y-1/2 min-w-6 h-6 px-1.5 rounded-full border text-xs font-medium shadow-sm ${
            hidden && hidden.down > 0
              ? 'bg-red-600 border-red-600 text-white'
              : hidden && hidden.unreachable > 0
              ? 'bg-gray-600 border-gray-600 text-white'
              : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-200'
          }`}
          aria-label={hidden ? `Mostrar ${hidden.total} equipos debajo de ${node.name}` : `Ocultar lo que cuelga de ${node.name}`}
          title={
            hidden
              ? `${hidden.total} ocultos${hidden.down ? ` · ${hidden.down} caído${hidden.down === 1 ? '' : 's'}` : ''}${hidden.unreachable ? ` · ${hidden.unreachable} sin alcance` : ''}`
              : 'Ocultar'
          }
        >
          {hidden ? `+${hidden.total}` : '−'}
        </button>
      )}
      <Handle type="source" position={Position.Right} className="!opacity-0" isConnectable={false} />
    </div>
  );
});

const NODE_TYPES = { device: DeviceNodeCard };

/** Below this the names are unreadable; a big tree is panned rather than shrunk past it. */
const MIN_READABLE_ZOOM = 0.55;

const EDGE_STYLE: Record<TopologyNodeDTO['reachability'], React.CSSProperties> = {
  UP: { stroke: '#9ca3af' },
  UNKNOWN: { stroke: '#9ca3af' },
  DOWN: { stroke: '#ef4444', strokeWidth: 2 },
  UNREACHABLE: { stroke: '#9ca3af', strokeDasharray: '5 4' },
};

interface NetworkGraphProps {
  nodes: TopologyNodeDTO[];
  /** A device to unfold the way to, select and centre on when the map opens. */
  initialFocus?: string | null;
}

function Graph({ nodes: all, initialFocus }: NetworkGraphProps) {
  const { theme } = useSettings();
  const { setCenter, fitView, getZoom } = useReactFlow();
  const index = useMemo(() => indexTopology(all), [all]);

  // The device the map opens on, when it is on the map.
  const opensOn = initialFocus && index.byId.has(initialFocus) ? initialFocus : null;
  // Seeded once from the first answer; a refetch keeps what the operator unfolded.
  const [folded, setFolded] = useState<Set<string> | null>(() => {
    if (!opensOn) return null;
    const next = initialFolds(index);
    for (const a of ancestorsOf(index, opensOn)) next.delete(a);
    return next;
  });
  const folds = useMemo(() => folded ?? initialFolds(index), [folded, index]);
  const [selectedId, setSelectedId] = useState<string | null>(opensOn);
  const [locationId, setLocationId] = useState('');
  const [problemsOnly, setProblemsOnly] = useState(false);

  // A device to centre on once the next layout lands, and whether that layout
  // should skip the framing effect (it would zoom away from the device).
  const pendingFocus = useRef<{ id: string; zoom?: number } | null>(opensOn ? { id: opensOn, zoom: 1.1 } : null);
  const focusing = useRef(!!opensOn);

  // Folding keeps the toggled device where the operator was looking.
  const toggle = useCallback(
    (id: string) => {
      focusing.current = true;
      pendingFocus.current = { id };
      setFolded((prev) => {
        const next = new Set(prev ?? initialFolds(index));
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [index]
  );

  const keep = useMemo(() => {
    if (!locationId && !problemsOnly) return null;
    return (n: TopologyNodeDTO) =>
      (!locationId || n.locationId === locationId) &&
      (!problemsOnly || n.reachability === 'DOWN' || n.reachability === 'UNREACHABLE');
  }, [locationId, problemsOnly]);

  // A filter shows its matches wherever they hang, so folds would only hide them.
  const shown = useMemo(() => visibleNodes(index, keep ? new Set() : folds, keep), [index, folds, keep]);
  const positions = useMemo(() => layout(shown), [shown]);

  const flowNodes: DeviceNode[] = useMemo(
    () =>
      shown.map((n) => {
        const isFolded = !keep && folds.has(n.id);
        return {
          id: n.id,
          type: 'device',
          position: positions.get(n.id)!,
          draggable: false,
          data: {
            node: n,
            childCount: index.children.get(n.id)?.length ?? 0,
            hidden: isFolded ? summarise(descendantsOf(index, n.id)) : null,
            selected: n.id === selectedId,
            // An ancestor drawn only to connect a match is context, not a match.
            dimmed: !!keep && !keep(n),
            onToggle: toggle,
          },
        };
      }),
    [shown, positions, index, folds, keep, selectedId, toggle]
  );

  const flowEdges: Edge[] = useMemo(() => {
    const ids = new Set(shown.map((n) => n.id));
    return shown
      .filter((n) => n.upstreamDeviceId && ids.has(n.upstreamDeviceId))
      .map((n) => ({
        id: `${n.upstreamDeviceId}->${n.id}`,
        source: n.upstreamDeviceId!,
        target: n.id,
        type: 'smoothstep',
        style: EDGE_STYLE[n.reachability],
      }));
  }, [shown]);

  // A device picked from the search is centred once its path is unfolded and laid out.
  const centreOn = useCallback(
    (p: { x: number; y: number }, zoom?: number) =>
      setCenter(p.x + NODE_WIDTH / 2, p.y + NODE_HEIGHT / 2, { zoom: zoom ?? getZoom(), duration: 400 }),
    [setCenter, getZoom]
  );
  useEffect(() => {
    const target = pendingFocus.current;
    const p = target ? positions.get(target.id) : undefined;
    if (!target || !p) return;
    pendingFocus.current = null;
    centreOn(p, target.zoom);
  }, [positions, centreOn]);

  // Re-frames when what is drawn changes shape, not on every refetch — and
  // not when the change is a search unfolding the path to its match.
  const shapeKey = `${shown.length}:${locationId}:${problemsOnly}`;
  useEffect(() => {
    if (focusing.current) {
      focusing.current = false;
      return;
    }
    const t = setTimeout(() => fitView({ padding: 0.15, duration: 300, minZoom: MIN_READABLE_ZOOM, maxZoom: 1.2 }), 50);
    return () => clearTimeout(t);
  }, [shapeKey, fitView]);

  /** Unfolds the path to a device, selects it and centres on it. */
  const focus = (id: string) => {
    if (!id) return;
    const path = ancestorsOf(index, id);
    // Only a change of shape re-runs the framing effect, so only then is there one to skip.
    const reshapes = path.some((a) => folds.has(a)) || !!keep;
    focusing.current = reshapes;
    setFolded((prev) => {
      const next = new Set(prev ?? initialFolds(index));
      for (const a of path) next.delete(a);
      return next;
    });
    setLocationId('');
    setProblemsOnly(false);
    setSelectedId(id);
    // Nothing to unfold: it is already where it will stay.
    const here = positions.get(id);
    if (!reshapes && here) centreOn(here, 1.1);
    else pendingFocus.current = { id, zoom: 1.1 };
  };

  const counts = useMemo(() => summarise(all), [all]);
  const locations = useMemo(() => {
    const seen = new Map<string, string>();
    for (const n of all) if (n.locationId && n.locationName) seen.set(n.locationId, n.locationName);
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]));
  }, [all]);
  const selected = selectedId ? index.byId.get(selectedId) ?? null : null;
  const faults = all.filter((n) => n.reachability === 'DOWN');

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="w-full sm:w-72">
          <Combobox
            value=""
            onChange={focus}
            options={all.map((n) => ({ value: n.id, label: n.name, sublabel: n.ipAddress ?? undefined }))}
            placeholder="Buscar equipo por nombre o IP"
            fullWidth
          />
        </div>
        <div className="flex-1 min-w-36 sm:flex-none sm:w-56">
          <Select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            options={[{ value: '', label: 'Todas las ubicaciones' }, ...locations.map(([value, label]) => ({ value, label }))]}
            fullWidth
          />
        </div>
        <Switch
          id="topology-problems-only"
          label="Solo con problemas"
          checked={problemsOnly}
          onChange={(e) => setProblemsOnly(e.target.checked)}
        />
        <div className="flex flex-wrap items-center gap-2 text-sm sm:ml-auto">
          <span className="text-gray-500 dark:text-gray-400">{all.length} equipos</span>
          {counts.down > 0 && <Badge variant="danger">{counts.down} caído{counts.down === 1 ? '' : 's'}</Badge>}
          {counts.unreachable > 0 && <Badge variant="neutral">{counts.unreachable} sin alcance</Badge>}
        </div>
      </div>

      {faults.length > 0 && (
        <div className="px-4 py-2 text-sm bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-red-800 dark:text-red-300">
          <span className="font-medium">Dónde está la falla:</span>{' '}
          {faults.map((f, i) => (
            <React.Fragment key={f.id}>
              {i > 0 && ', '}
              <button type="button" className="underline hover:no-underline" onClick={() => focus(f.id)}>
                {f.name}
              </button>
            </React.Fragment>
          ))}
          {counts.unreachable > 0 && (
            <span className="text-red-700/80 dark:text-red-300/80">
              {' '}— los {counts.unreachable} sin alcance cuelgan de ahí y probablemente están bien.
            </span>
          )}
        </div>
      )}

      <div className="relative flex-1 min-h-0">
        {shown.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {keep ? (
              'Ningún equipo coincide con el filtro.'
            ) : (
              <>
                Todavía no hay equipos enlazados: indica de qué equipo cuelga cada uno, o acepta las{' '}
                <Link href="/topology?tab=suggestions" className="text-brand-600 dark:text-brand-400 hover:underline">
                  sugerencias
                </Link>
                .
              </>
            )}
          </div>
        ) : (
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={NODE_TYPES}
            colorMode={theme}
            nodesConnectable={false}
            nodesDraggable={false}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            minZoom={0.1}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        )}

        {selected && (
          <SelectedPanel
            node={selected}
            upstream={selected.upstreamDeviceId ? index.byId.get(selected.upstreamDeviceId) ?? null : null}
            below={descendantsOf(index, selected.id)}
            onFocus={focus}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      {index.unlinked.length > 0 && !keep && <UnlinkedList nodes={index.unlinked} />}
    </div>
  );
}

function SelectedPanel({
  node,
  upstream,
  below,
  onFocus,
  onClose,
}: {
  node: TopologyNodeDTO;
  upstream: TopologyNodeDTO | null;
  below: TopologyNodeDTO[];
  onFocus: (id: string) => void;
  onClose: () => void;
}) {
  const r = REACHABILITY[node.reachability];
  const hidden = summarise(below);
  return (
    <div className="absolute z-10 inset-x-2 bottom-2 sm:inset-x-auto sm:right-3 sm:top-3 sm:bottom-auto sm:w-80 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{node.name}</p>
          <p className="font-mono text-xs text-gray-500 dark:text-gray-400">{node.ipAddress ?? 'sin IP'}</p>
        </div>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Cerrar">
          ✕
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant={r.variant}>{r.label}</Badge>
        {node.downSince && <span className="text-xs text-gray-500 dark:text-gray-400">desde {new Date(node.downSince).toLocaleString('es')}</span>}
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{r.hint}</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-gray-500 dark:text-gray-400">Categoría</dt>
        <dd className="text-gray-900 dark:text-gray-100">{deviceCategoryLabel(node.category)}</dd>
        <dt className="text-gray-500 dark:text-gray-400">Ubicación</dt>
        <dd className="text-gray-900 dark:text-gray-100">{node.locationName ?? '—'}</dd>
        <dt className="text-gray-500 dark:text-gray-400">Cuelga de</dt>
        <dd>
          {upstream ? (
            <button type="button" className="text-brand-600 dark:text-brand-400 hover:underline text-left" onClick={() => onFocus(upstream.id)}>
              {upstream.name}
            </button>
          ) : (
            <span className="text-gray-900 dark:text-gray-100">Raíz de la red</span>
          )}
        </dd>
        <dt className="text-gray-500 dark:text-gray-400">Debajo</dt>
        <dd className="text-gray-900 dark:text-gray-100">
          {hidden.total === 0
            ? 'Nada'
            : `${hidden.total} equipo${hidden.total === 1 ? '' : 's'}${hidden.down ? `, ${hidden.down} caído${hidden.down === 1 ? '' : 's'}` : ''}${hidden.unreachable ? `, ${hidden.unreachable} sin alcance` : ''}`}
        </dd>
      </dl>
      <Link href={`/devices/${node.id}`} className="mt-3 inline-block font-medium text-brand-600 dark:text-brand-400 hover:underline">
        Abrir equipo →
      </Link>
    </div>
  );
}

function UnlinkedList({ nodes }: { nodes: TopologyNodeDTO[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        aria-expanded={open}
      >
        <span>
          <span className="font-medium">{nodes.length} sin enlazar</span>
          <span className="text-gray-500 dark:text-gray-400"> — no cuelgan de nada ni tienen nada debajo, así que no aparecen en el mapa.</span>
        </span>
        <span aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <p className="px-4 pb-2 text-gray-500 dark:text-gray-400">
          Indica de qué equipo cuelga cada uno en su ficha, o revisa las{' '}
          <Link href="/topology?tab=suggestions" className="text-brand-600 dark:text-brand-400 hover:underline">
            sugerencias
          </Link>
          .
        </p>
      )}
      {open && (
        <ul className="max-h-48 overflow-y-auto px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
          {nodes.map((n) => (
            <li key={n.id} className="flex items-center gap-2 min-w-0">
              <span className={`h-2 w-2 shrink-0 rounded-full ${REACHABILITY[n.reachability].dot}`} />
              <Link href={`/devices/${n.id}`} className="truncate text-brand-600 dark:text-brand-400 hover:underline">
                {n.name}
              </Link>
              <span className="font-mono text-xs text-gray-500 dark:text-gray-400 shrink-0">{n.ipAddress}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The network map: the linked devices as a left-to-right tree, coloured by reachability (DEV-186). */
export default function NetworkGraph(props: NetworkGraphProps) {
  return (
    <ReactFlowProvider>
      <Graph {...props} />
    </ReactFlowProvider>
  );
}
