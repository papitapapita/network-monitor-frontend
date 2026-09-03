'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { useEffect } from 'react';

// São Paulo, matching MapView's fallback — used only until the operator clicks.
const DEFAULT_CENTER: [number, number] = [-23.55, -46.63];

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

function Recenter({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, Math.max(map.getZoom(), 15), { animate: true, duration: 0.5 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.[0], position?.[1]]);
  return null;
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
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  const position: [number, number] | null = !isNaN(lat) && !isNaN(lon) ? [lat, lon] : null;

  return (
    <div className={className}>
      <MapContainer
        center={position ?? DEFAULT_CENTER}
        zoom={position ? 16 : 5}
        className="h-full w-full"
        style={{ zIndex: 0 }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
        />
        <ClickHandler onPick={onPick} />
        <Recenter position={position} />
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
    </div>
  );
}
