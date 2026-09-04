'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { useEffect, useState } from 'react';

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
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  const position: [number, number] | null = !isNaN(lat) && !isNaN(lon) ? [lat, lon] : null;
  const geoCenter = useGeolocatedCenter(position !== null);
  const tiles = satellite ? SATELLITE_TILES : STREET_TILES;

  return (
    <div className={`relative ${className}`}>
      <MapContainer
        center={position ?? geoCenter ?? DEFAULT_CENTER}
        zoom={position ? 16 : geoCenter ? 14 : 5}
        className="h-full w-full"
        style={{ zIndex: 0 }}
      >
        <TileLayer url={tiles.url} attribution={tiles.attribution} />
        <ClickHandler onPick={onPick} />
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
      <button
        type="button"
        onClick={() => setSatellite((s) => !s)}
        className="absolute bottom-2 right-2 z-[400] rounded-md bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 shadow-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        {satellite ? 'Ver calles' : 'Ver satélite'}
      </button>
    </div>
  );
}
