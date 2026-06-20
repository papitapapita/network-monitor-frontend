'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import { MapPin } from '@/types/map.types';
import { LOCATION_TYPE_COLORS, LOCATION_TYPE_LABELS } from '@/constants/location.constants';
import { DEVICE_STATUS_COLORS as STATUS_COLORS, DEVICE_STATUS_LABELS as STATUS_LABELS } from '@/constants/device.constants';

function createPinIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:20px;height:20px;border-radius:50%;
      background:${color};border:2.5px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      pointer-events:none;
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -14],
  });
}

function MapLayers({ pins }: { pins: MapPin[] }) {
  const map = useMap();

  useEffect(() => {
    if (pins.length === 0) return;
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
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          position={[pin.latitude, pin.longitude]}
          icon={createPinIcon(LOCATION_TYPE_COLORS[pin.locationType] ?? '#9ca3af')}
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
                    {pin.devices.map((dev) => (
                      <div key={dev.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: STATUS_COLORS[dev.status] ?? '#9ca3af',
                          flexShrink: 0,
                        }} />
                        <span style={{ flex: 1, color: '#111827', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {dev.name}
                        </span>
                        <span style={{ color: '#9ca3af', fontSize: '11px', flexShrink: 0 }}>
                          {STATUS_LABELS[dev.status] ?? dev.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

interface MapViewProps {
  pins: MapPin[];
  className?: string;
}

export default function MapView({ pins, className = 'h-full w-full' }: MapViewProps) {
  const center = pins.length > 0
    ? ([pins[0].latitude, pins[0].longitude] as [number, number])
    : ([-23.55, -46.63] as [number, number]);

  return (
    <MapContainer
      center={center}
      zoom={5}
      className={className}
      style={{ zIndex: 0 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
      />
      <MapLayers pins={pins} />
    </MapContainer>
  );
}
