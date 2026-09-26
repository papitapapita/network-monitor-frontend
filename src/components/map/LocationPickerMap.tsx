'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip, CollapseIcon, ExpandIcon, LocateIcon } from '@/components/ui';

// São Paulo, matching MapView's fallback — used only until the operator clicks
// and the browser's own geolocation (if granted) hasn't resolved yet either.
const DEFAULT_CENTER: [number, number] = [-23.55, -46.63];

const STREET_TILES = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
};
const SATELLITE_TILES = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: '&copy; Esri, Maxar, Earthstar Geographics',
};

const markerIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:22px;height:22px;border-radius:50% 50% 50% 0;
    background:#2563eb;border:2.5px solid white;
    box-shadow:0 2px 6px rgba(0,0,0,0.35);
    transform:rotate(-45deg);
  "></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

function ClickHandler({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ position, geoCenter }: { position: [number, number] | null; geoCenter: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, Math.max(map.getZoom(), 15), { animate: true, duration: 0.5 });
    } else if (geoCenter) {
      // Nothing picked yet — recenter on the operator's own location so the map
      // opens somewhere useful instead of defaulting to São Paulo.
      map.flyTo(geoCenter, Math.max(map.getZoom(), 14), { animate: true, duration: 0.5 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.[0], position?.[1], geoCenter?.[0], geoCenter?.[1]]);
  return null;
}

/** Keeps the latest center/zoom so the map reopens where the operator left it when toggling size. */
function ViewTracker({ viewRef }: { viewRef: React.MutableRefObject<{ center: [number, number]; zoom: number } | null> }) {
  const map = useMapEvents({
    moveend() {
      const c = map.getCenter();
      viewRef.current = { center: [c.lat, c.lng], zoom: map.getZoom() };
    },
  });
  return null;
}

const controlButtonClass =
  'rounded-md bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 shadow-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60 disabled:cursor-wait';

/** Resolves once via the browser's geolocation API; null if denied, unsupported, or still pending. */
function useGeolocatedCenter(skip: boolean): [number, number] | null {
  const [center, setCenter] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (skip || typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: false, timeout: 8000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  return center;
}

interface LocationPickerMapProps {
  latitude: string;
  longitude: string;
  onPick: (lat: number, lon: number) => void;
  className?: string;
}

export default function LocationPickerMap({
  latitude,
  longitude,
  onPick,
  className = 'h-64 w-full rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600',
}: LocationPickerMapProps) {
  const [satellite, setSatellite] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const viewRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const [startView, setStartView] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  const position: [number, number] | null = !isNaN(lat) && !isNaN(lon) ? [lat, lon] : null;
  const geoCenter = useGeolocatedCenter(position !== null);
  const tiles = satellite ? SATELLITE_TILES : STREET_TILES;

  useEffect(() => {
    if (!expanded) return;
    // Capture phase on window so Escape shrinks the map without also closing an enclosing Modal.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setStartView(viewRef.current);
        setExpanded(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [expanded]);

  const locateMe = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocateError('El navegador no permite obtener la ubicación.');
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onPick(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setLocating(false);
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? 'Permiso de ubicación denegado.'
            : 'No se pudo obtener la ubicación.'
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // The expanded map remounts inside a portal, so it starts from the last view the operator saw.
  const initialCenter = startView?.center ?? position ?? geoCenter ?? DEFAULT_CENTER;
  const initialZoom = startView?.zoom ?? (position ? 16 : geoCenter ? 14 : 5);
  const toggleExpanded = () => {
    setStartView(viewRef.current);
    setExpanded((x) => !x);
  };

  const map = (
    <div
      className={
        expanded
          ? 'relative h-full w-full rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 shadow-2xl'
          : `relative ${className}`
      }
    >
      <MapContainer center={initialCenter} zoom={initialZoom} className="h-full w-full" style={{ zIndex: 0 }}>
        <TileLayer url={tiles.url} attribution={tiles.attribution} />
        <ClickHandler onPick={onPick} />
        <ViewTracker viewRef={viewRef} />
        <Recenter position={position} geoCenter={geoCenter} />
        {position && (
          <Marker
            position={position}
            icon={markerIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = (e.target as L.Marker).getLatLng();
                onPick(lat, lng);
              },
            }}
          />
        )}
      </MapContainer>
      <div className="absolute top-2 right-2 z-[400] flex flex-col items-end gap-1.5">
        <Tooltip label={expanded ? 'Reducir mapa (Esc)' : 'Ampliar mapa'} side="left">
          <button
            type="button"
            onClick={toggleExpanded}
            aria-label={expanded ? 'Reducir mapa' : 'Ampliar mapa'}
            className={`${controlButtonClass} !p-1.5`}
          >
            {expanded ? <CollapseIcon /> : <ExpandIcon />}
          </button>
        </Tooltip>
        <Tooltip label={locating ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'} side="left">
          <button
            type="button"
            onClick={locateMe}
            disabled={locating}
            aria-label="Usar mi ubicación actual"
            className={`${controlButtonClass} !p-1.5 ${locating ? 'animate-pulse' : ''}`}
          >
            <LocateIcon />
          </button>
        </Tooltip>
        {locateError && (
          <span className="rounded-md bg-red-50 dark:bg-red-900/60 px-2 py-1 text-xs text-red-700 dark:text-red-200 shadow-md">
            {locateError}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => setSatellite((s) => !s)}
        className={`absolute bottom-2 right-2 z-[400] ${controlButtonClass}`}
      >
        {satellite ? 'Ver calles' : 'Ver satélite'}
      </button>
    </div>
  );

  if (!expanded) return map;

  // Portaled to <body>: the Modal panel uses `transform`, which would otherwise trap a fixed overlay inside it.
  return (
    <>
      <div className={className} aria-hidden />
      {createPortal(
        <div className="fixed inset-0 z-[60] bg-black/50 p-4 sm:p-8" onClick={toggleExpanded}>
          <div className="h-full w-full" onClick={(e) => e.stopPropagation()}>
            {map}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
