'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { BaseTiles, MAP_CONTROL_BUTTON_CLASS } from './BaseTiles';
import { mapTopology, pinReachability, type LinkLine, type MapTopology } from './topologyLinks';
import { sinceLabel } from '@/components/topology/topologyTree';
import { Switch } from '@/components/ui';
import { ConfirmModal } from '@/components/ui/Modal';
import { apiService } from '@/services/api.service';
import { useToast } from '@/contexts/toast.context';
import { usePermissions } from '@/hooks/usePermissions';
import { TOPOLOGY_QUERY_KEY } from '@/hooks/useTopology';
import { MapPin, MapPinDevice } from '@/types/map.types';
import type { TopologyNodeDTO, TopologyReachability } from '@/types/topology.types';
import { LOCATION_TYPE_COLORS, LOCATION_TYPE_LABELS } from '@/constants/location.constants';
import { DEVICE_STATUS_COLORS as STATUS_COLORS, DEVICE_STATUS_LABELS as STATUS_LABELS } from '@/constants/device.constants';
import { REACHABILITY } from '@/constants/topology.constants';

// Every poll re-renders the markers; a cached icon is not swapped for an equal one.
const pinIcons = new Map<string, L.DivIcon>();

function createPinIcon(color: string, halo: string | null = null): L.DivIcon {
  const key = `${color}|${halo}`;
  let icon = pinIcons.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: '',
      html: `<div style="
        width:20px;height:20px;border-radius:50%;
        background:${color};border:2.5px solid white;
        box-shadow:${halo ? `0 0 0 4px ${halo},` : ''}0 2px 6px rgba(0,0,0,0.35);
        pointer-events:none;
      "></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -14],
    });
    pinIcons.set(key, icon);
  }
  return icon;
}

/** A site in the colour of its connection; the one with the fault also gets a halo. */
function pinIconFor(pin: MapPin, topology: MapTopology | null): L.DivIcon {
  const state = pinReachability(topology?.byLocation.get(pin.id));
  return createPinIcon(REACHABILITY[state].stroke, state === 'DOWN' ? 'rgba(239,68,68,0.35)' : null);
}

const arrowIcons = new Map<string, L.DivIcon>();

function arrowIcon(color: string, degrees: number): L.DivIcon {
  const key = `${color}|${degrees}`;
  let icon = arrowIcons.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: '',
      html: `<svg width="20" height="20" viewBox="0 0 20 20" style="display:block;overflow:visible;transform:rotate(${degrees}deg)">
        <path d="M3 3 L17 10 L3 17 Z" fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round"/>
      </svg>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    arrowIcons.set(key, icon);
  }
  return icon;
}

/**
 * An arrowhead 60% of the way from `from` to `to`, pointing at `to`. Leaflet
 * draws a line straight in Web Mercator, which keeps angles at every zoom, so
 * one placement holds.
 */
function arrowAlong(from: MapPin, to: MapPin): { position: L.LatLng; degrees: number } {
  const crs = L.CRS.EPSG3857;
  const a = crs.latLngToPoint(L.latLng(from.latitude, from.longitude), 0);
  const b = crs.latLngToPoint(L.latLng(to.latitude, to.longitude), 0);
  const degrees = Math.round((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
  return { position: crs.pointToLatLng(a.add(b.subtract(a).multiplyBy(0.6)), 0), degrees };
}

function LinkArrow({ from, to, color }: { from: MapPin; to: MapPin; color: string }) {
  const { position, degrees } = arrowAlong(from, to);
  return <Marker position={position} icon={arrowIcon(color, degrees)} interactive={false} keyboard={false} />;
}

/** DOWN is the fault, solid; UNREACHABLE is only cut off by it, dashed. */
function linePathOptions(r: TopologyReachability): L.PathOptions {
  return {
    color: REACHABILITY[r].stroke,
    weight: r === 'DOWN' ? 4 : 3,
    opacity: 0.9,
    dashArray: r === 'UNREACHABLE' ? '6 6' : undefined,
  };
}

function reachabilityText(node: TopologyNodeDTO): string {
  const label = REACHABILITY[node.reachability].label;
  const since = node.reachability === 'DOWN' || node.reachability === 'UNREACHABLE' ? sinceLabel(node.downSince) : null;
  return since ? `${label} ${since}` : label;
}

/** Each line points from the device to the one it depends on, as its popup reads. */
function LinkLines({ lines }: { lines: LinkLine[] }) {
  return (
    <>
      {lines.map((line) => (
        <LinkArrow key={`${line.key}>`} from={line.from} to={line.to} color={REACHABILITY[line.reachability].stroke} />
      ))}
      {lines.filter((l) => l.backward).map((line) => (
        <LinkArrow key={`${line.key}<`} from={line.to} to={line.from} color={REACHABILITY[line.reachability].stroke} />
      ))}
      {lines.map((line) => (
        <Polyline
          key={line.key}
          positions={[
            [line.from.latitude, line.from.longitude],
            [line.to.latitude, line.to.longitude],
          ]}
          pathOptions={linePathOptions(line.reachability)}
        >
          <Popup minWidth={200} maxWidth={300}>
            <div style={{ fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
              {line.links.map(({ child, upstream }) => (
                <div key={child.id} style={{ fontSize: '12px' }}>
                  <div style={{ fontWeight: 600, color: '#111827' }}>
                    {child.name} → {upstream.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: REACHABILITY[child.reachability].stroke }} />
                    {reachabilityText(child)}
                  </div>
                </div>
              ))}
            </div>
          </Popup>
        </Polyline>
      ))}
    </>
  );
}

/** What the popups may offer; a missing one is not the user's to do. */
interface PinActions {
  removeDevice?: (pin: MapPin, device: MapPinDevice) => void;
  deleteLocation?: (pin: MapPin) => void;
}

const POPUP_ACTION_STYLE: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  color: '#dc2626',
  fontSize: '11px',
  fontWeight: 500,
  flexShrink: 0,
};

function MapLayers({ pins, topology, showLinks, actions }: { pins: MapPin[]; topology: MapTopology | null; showLinks: boolean; actions: PinActions }) {
  const map = useMap();
  // Framed once: a pin reload after a removal must not throw the view back out.
  const framed = useRef(false);

  useEffect(() => {
    if (pins.length === 0 || framed.current) return;
    framed.current = true;
    if (pins.length === 1) {
      map.setView([pins[0].latitude, pins[0].longitude], 15);
      return;
    }
    const bounds = L.latLngBounds(pins.map((p) => [p.latitude, p.longitude]));
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const spread = Math.max(Math.abs(ne.lat - sw.lat), Math.abs(ne.lng - sw.lng));

    if (spread <= 1) {
      // Pins in the same city/region — zoom to fit at street level
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    } else {
      // Pins span multiple cities or countries — fitBounds would zoom out too far.
      // Apply it without animation so we can immediately correct the zoom floor.
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: false });
      if (map.getZoom() < 5) {
        map.setView(bounds.getCenter(), 5, { animate: false });
      }
    }
  }, [map, pins]);

  return (
    <>
      {showLinks && topology && <LinkLines lines={topology.lines} />}
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          position={[pin.latitude, pin.longitude]}
          icon={pinIconFor(pin, topology)}
          eventHandlers={{
            click: () => {
              map.flyTo(
                [pin.latitude, pin.longitude],
                Math.max(map.getZoom(), 15),
                { animate: true, duration: 0.5 }
              );
            },
          }}
        >
          <Popup minWidth={220} maxWidth={300} autoPan={false}>
            <div style={{ fontFamily: 'inherit' }}>
              {/* Header */}
              <div style={{ marginBottom: '6px' }}>
                <span style={{
                  display: 'inline-block',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'white',
                  background: LOCATION_TYPE_COLORS[pin.locationType] ?? '#9ca3af',
                  borderRadius: '4px',
                  padding: '1px 6px',
                  marginBottom: '4px',
                }}>
                  {LOCATION_TYPE_LABELS[pin.locationType] ?? pin.locationType}
                </span>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827', lineHeight: 1.3 }}>
                  {pin.name}
                </div>
              </div>

              {/* Address info */}
              {(pin.address || pin.neighborhood || pin.municipality) && (
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                  {[pin.address, pin.neighborhood, pin.municipality].filter(Boolean).join(' · ')}
                </div>
              )}

              {/* Device list */}
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  {pin.devices.length === 0
                    ? 'Sin dispositivos'
                    : `${pin.devices.length} dispositivo${pin.devices.length !== 1 ? 's' : ''}`}
                </div>
                {pin.devices.length > 0 && (
                  <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {pin.devices.map((dev) => {
                      // On the network: its reachability and what it hangs off. Otherwise its lifecycle status.
                      const node = topology?.index.byId.get(dev.id);
                      const upstream = node?.upstreamDeviceId ? topology?.index.byId.get(node.upstreamDeviceId) : undefined;
                      return (
                        <div key={dev.id} style={{ fontSize: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              display: 'inline-block',
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: node ? REACHABILITY[node.reachability].stroke : STATUS_COLORS[dev.status] ?? '#9ca3af',
                              flexShrink: 0,
                            }} />
                            <Link
                              href={`/devices/${dev.id}`}
                              className="hover:underline"
                              style={{ flex: 1, color: '#111827', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              {dev.name}
                            </Link>
                            <span style={{ color: '#9ca3af', fontSize: '11px', flexShrink: 0 }}>
                              {node ? reachabilityText(node) : STATUS_LABELS[dev.status] ?? dev.status}
                            </span>
                            {actions.removeDevice && (
                              <button
                                type="button"
                                className="hover:underline"
                                style={POPUP_ACTION_STYLE}
                                title={`Quitar ${dev.name} de esta ubicación`}
                                onClick={() => actions.removeDevice!(pin, dev)}
                              >
                                Quitar
                              </button>
                            )}
                          </div>
                          {upstream && (
                            <div style={{ paddingLeft: '14px', color: '#6b7280', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              depende de {upstream.name}
                              {upstream.locationId === pin.id ? ' (aquí)' : upstream.locationName ? ` · ${upstream.locationName}` : ''}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {actions.deleteLocation && (
                <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '8px', paddingTop: '8px', fontSize: '11px' }}>
                  {pin.devices.length === 0 ? (
                    <button
                      type="button"
                      className="hover:underline"
                      style={POPUP_ACTION_STYLE}
                      onClick={() => actions.deleteLocation!(pin)}
                    >
                      Eliminar ubicación
                    </button>
                  ) : (
                    // The backend refuses (409) while any device is still assigned.
                    <span style={{ color: '#9ca3af' }}>Para eliminar la ubicación, quita primero sus dispositivos.</span>
                  )}
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

const LEGEND_ORDER: TopologyReachability[] = ['DOWN', 'UNREACHABLE', 'UP', 'UNKNOWN'];

const MAP_PANEL_CLASS =
  'rounded-md bg-white dark:bg-gray-800 px-2.5 py-2 text-xs text-gray-700 dark:text-gray-200 shadow-md border border-gray-300 dark:border-gray-600';

/** The pin colours, and the line colours beside them while the lines are shown. */
function Legend({ showLinks }: { showLinks: boolean }) {
  return (
    <ul className="mt-2 space-y-1">
      {LEGEND_ORDER.map((r) => {
        const o = linePathOptions(r);
        return (
          <li key={r} className="flex items-center gap-2" title={REACHABILITY[r].hint}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: o.color }} aria-hidden="true" />
            {showLinks && (
              <svg width="24" height="6" aria-hidden="true" className="shrink-0">
                <line x1="0" y1="3" x2="24" y2="3" stroke={o.color} strokeWidth={o.weight} strokeDasharray={o.dashArray as string | undefined} />
              </svg>
            )}
            {REACHABILITY[r].label}
          </li>
        );
      })}
    </ul>
  );
}

/** Links with an end that has no place on the map, so their line is missing. */
function OffMapNote({ links }: { links: MapTopology['offMap'] }) {
  return (
    <details className={`${MAP_PANEL_CLASS} max-w-72`}>
      <summary className="cursor-pointer font-medium">
        {links.length} enlace{links.length === 1 ? '' : 's'} fuera del mapa
      </summary>
      <ul className="mt-2 max-h-48 overflow-y-auto space-y-1.5">
        {links.map(({ child, upstream, reason }) => (
          <li key={child.id}>
            <div className="font-medium text-gray-900 dark:text-gray-100 wrap-anywhere">
              {child.name} → {upstream.name}
            </div>
            <div className="text-gray-500 dark:text-gray-400">{reason}</div>
          </li>
        ))}
      </ul>
    </details>
  );
}

interface MapViewProps {
  pins: MapPin[];
  /** The network graph; until it arrives the map shows the pins alone. */
  topology?: TopologyNodeDTO[];
  className?: string;
}

type PendingRemoval = { kind: 'device'; pin: MapPin; device: MapPinDevice } | { kind: 'location'; pin: MapPin };

/**
 * An ACTIVE device must have a location, so taking it off site retires it to
 * inventory in the same request (monitoring stops); any other status just
 * loses its location.
 */
const removalPatch = (device: MapPinDevice) =>
  device.status === 'ACTIVE' ? { locationId: null, status: 'INVENTORY' as const } : { locationId: null };

function removalMessage(p: PendingRemoval): string {
  if (p.kind === 'location') return `¿Eliminar la ubicación «${p.pin.name}»? Esta acción no se puede deshacer.`;
  return p.device.status === 'ACTIVE'
    ? `«${p.device.name}» está activo: quitarlo de «${p.pin.name}» lo devuelve al inventario y deja de monitorearse.`
    : `¿Quitar «${p.device.name}» de «${p.pin.name}»? El equipo queda sin ubicación.`;
}

export default function MapView({ pins, topology, className = 'h-full w-full' }: MapViewProps) {
  const permissions = usePermissions();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingRemoval | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const actions: PinActions = {
    removeDevice: permissions.canWrite ? (pin, device) => setPending({ kind: 'device', pin, device }) : undefined,
    deleteLocation: permissions.isAdmin ? (pin) => setPending({ kind: 'location', pin }) : undefined,
  };

  const confirmRemoval = async () => {
    if (!pending) return;
    setIsRemoving(true);
    const r =
      pending.kind === 'device'
        ? await apiService.updateDevice(pending.device.id, removalPatch(pending.device))
        : await apiService.deleteLocation(pending.pin.id);
    setIsRemoving(false);
    if (!r.success) {
      showError(r.error || (pending.kind === 'device' ? 'Error al quitar el dispositivo' : 'Error al eliminar la ubicación'));
      return;
    }
    showSuccess(pending.kind === 'device' ? `«${pending.device.name}» quitado de «${pending.pin.name}».` : 'Ubicación eliminada.');
    setPending(null);
    queryClient.invalidateQueries({ queryKey: ['locationMapPins'] });
    queryClient.invalidateQueries({ queryKey: TOPOLOGY_QUERY_KEY });
  };

  const center = pins.length > 0
    ? ([pins[0].latitude, pins[0].longitude] as [number, number])
    : ([-23.55, -46.63] as [number, number]);
  const [satellite, setSatellite] = useState(false);
  const [showLinks, setShowLinks] = useState(true);
  const joined = useMemo(() => (topology ? mapTopology(pins, topology) : null), [pins, topology]);

  return (
    <div className={`relative ${className}`}>
      <MapContainer center={center} zoom={5} className="h-full w-full" style={{ zIndex: 0 }}>
        <BaseTiles satellite={satellite} />
        <MapLayers pins={pins} topology={joined} showLinks={showLinks} actions={actions} />
      </MapContainer>
      <ConfirmModal
        isOpen={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={confirmRemoval}
        title={pending?.kind === 'location' ? 'Eliminar ubicación' : 'Quitar dispositivo'}
        message={pending ? removalMessage(pending) : ''}
        confirmText={pending?.kind === 'location' ? 'Eliminar' : 'Quitar'}
        cancelText="Cancelar"
        variant="danger"
        isLoading={isRemoving}
      />
      {joined && (
        <div className={`absolute top-2 right-2 z-[400] ${MAP_PANEL_CLASS}`}>
          <Switch
            id="map-topology-links"
            label="Enlaces de topología"
            checked={showLinks}
            onChange={(e) => setShowLinks(e.target.checked)}
          />
          <Legend showLinks={showLinks} />
        </div>
      )}
      {joined && showLinks && joined.offMap.length > 0 && (
        <div className="absolute bottom-6 left-2 z-[400]">
          <OffMapNote links={joined.offMap} />
        </div>
      )}
      <button
        type="button"
        onClick={() => setSatellite((s) => !s)}
        className={`absolute bottom-6 right-2 z-[400] ${MAP_CONTROL_BUTTON_CLASS}`}
      >
        {satellite ? 'Ver calles' : 'Ver satélite'}
      </button>
    </div>
  );
}
