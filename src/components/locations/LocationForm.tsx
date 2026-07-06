'use client';

import React, { useEffect } from 'react';
import { Input, Select } from '@/components/ui';
import type { LocationType, LocationResponseDTO, CreateLocationDTO } from '@/types/location.types';
import { LOCATION_TYPE_OPTIONS } from '@/constants/location.constants';

export interface LocationFormData {
  name: string;
  type: LocationType | '';
  municipality: string;
  neighborhood: string;
  address: string;
  latitude: string;
  longitude: string;
  altitude: string;
}

export const EMPTY_LOCATION_FORM: LocationFormData = {
  name: '',
  type: '',
  municipality: '',
  neighborhood: '',
  address: '',
  latitude: '',
  longitude: '',
  altitude: '',
};

export async function inferLocationFromCoords(
  lat: string,
  lon: string,
): Promise<{ municipality?: string; altitude?: number }> {
  const [geoResult, elevResult] = await Promise.allSettled([
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=es`,
    ).then((r) => (r.ok ? r.json() : null)),
    fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`,
    ).then((r) => (r.ok ? r.json() : null)),
  ]);

  const result: { municipality?: string; altitude?: number } = {};

  if (geoResult.status === 'fulfilled' && geoResult.value?.address) {
    const addr = geoResult.value.address;
    result.municipality = addr.municipality || addr.county || addr.town || addr.city;
  }

  if (elevResult.status === 'fulfilled' && elevResult.value?.elevation?.[0] != null) {
    result.altitude = Math.round(elevResult.value.elevation[0]);
  }

  return result;
}

function parseCoords(raw: string): { lat: string; lon: string } | null {
  const parts = raw.split(',').map((s) => s.trim());
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat: String(lat), lon: String(lon) };
}

export function validateLocationForm(formData: LocationFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!formData.name.trim()) errors.name = 'El nombre es requerido';
  else if (formData.name.trim().length > 150) errors.name = 'El nombre no puede superar los 150 caracteres';
  if (!formData.type) errors.type = 'El tipo es requerido';
  if (formData.municipality.trim().length > 100) {
    errors.municipality = 'El municipio no puede superar los 100 caracteres';
  }
  if (formData.neighborhood.trim().length > 150) {
    errors.neighborhood = 'El barrio no puede superar los 150 caracteres';
  }
  if (formData.address.trim().length > 255) {
    errors.address = 'La dirección no puede superar los 255 caracteres';
  }

  const lat = parseFloat(formData.latitude);
  const lon = parseFloat(formData.longitude);
  if (
    (formData.latitude && !formData.longitude) ||
    (!formData.latitude && formData.longitude)
  ) {
    errors.latitude = 'Latitud y longitud deben indicarse juntas';
  }
  if (formData.latitude && (lat < -90 || lat > 90)) {
    errors.latitude = 'Debe estar entre -90 y 90';
  }
  if (formData.longitude && (lon < -180 || lon > 180)) {
    errors.longitude = 'Debe estar entre -180 y 180';
  }
  if (formData.altitude && (!formData.latitude || !formData.longitude)) {
    errors.altitude = 'La altitud requiere latitud y longitud';
  }

  if (!errors.address && formData.address.trim() && (!formData.municipality.trim() || !formData.neighborhood.trim())) {
    errors.address = 'La dirección requiere municipio y barrio';
  }
  const hasCoords = !!(formData.latitude.trim() && formData.longitude.trim());
  if (!errors.address && formData.type === 'CUSTOMER_PREMISES' && !formData.address.trim() && !hasCoords) {
    errors.address = 'Una instalación de cliente requiere dirección o coordenadas';
  }

  return errors;
}

export function buildLocationDTO(formData: LocationFormData): CreateLocationDTO {
  const dto: CreateLocationDTO = {
    name: formData.name.trim(),
    type: formData.type as LocationType,
  };
  if (formData.municipality.trim()) dto.municipality = formData.municipality.trim();
  if (formData.neighborhood.trim()) dto.neighborhood = formData.neighborhood.trim();
  if (formData.address.trim()) dto.address = formData.address.trim();
  if (formData.latitude) dto.latitude = parseFloat(formData.latitude);
  if (formData.longitude) dto.longitude = parseFloat(formData.longitude);
  if (formData.altitude) dto.altitude = parseFloat(formData.altitude);
  return dto;
}

export function locationToForm(loc: LocationResponseDTO): LocationFormData {
  return {
    name: loc.name,
    type: loc.type,
    municipality: loc.municipality ?? '',
    neighborhood: loc.neighborhood ?? '',
    address: loc.address ?? '',
    latitude: loc.latitude != null ? String(loc.latitude) : '',
    longitude: loc.longitude != null ? String(loc.longitude) : '',
    altitude: loc.altitude != null ? String(loc.altitude) : '',
  };
}

interface LocationFormProps {
  formData: LocationFormData;
  formErrors: Record<string, string>;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onCoordsPaste?: (lat: string, lon: string) => void;
  isGeocoding?: boolean;
}

export function LocationForm({ formData, formErrors, onChange, onCoordsPaste, isGeocoding }: LocationFormProps) {
  const [coordsInput, setCoordsInput] = React.useState('');
  const [coordsError, setCoordsError] = React.useState('');

  useEffect(() => {
    if (!formData.latitude && !formData.longitude) {
      setCoordsInput('');
      setCoordsError('');
    }
  }, [formData.latitude, formData.longitude]);

  const handleCoordsPaste = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setCoordsInput(raw);
    if (!raw.trim()) { setCoordsError(''); return; }
    const parsed = parseCoords(raw);
    if (parsed) {
      setCoordsError('');
      onCoordsPaste?.(parsed.lat, parsed.lon);
    } else {
      setCoordsError('Formato inválido. Ej: 4.132689, -73.625153');
    }
  };

  return (
    <div className="space-y-4 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Nombre"
          name="name"
          value={formData.name}
          onChange={onChange}
          error={formErrors.name}
          maxLength={150}
          required
          fullWidth
        />
        <Select
          label="Tipo"
          name="type"
          value={formData.type}
          onChange={onChange}
          options={LOCATION_TYPE_OPTIONS}
          error={formErrors.type}
          required
          fullWidth
        />
      </div>

      <Input
        label="Dirección"
        name="address"
        value={formData.address}
        onChange={onChange}
        error={formErrors.address}
        maxLength={255}
        helperText={
          formData.type === 'CUSTOMER_PREMISES'
            ? 'Una instalación de cliente requiere dirección o coordenadas. La dirección requiere municipio y barrio.'
            : undefined
        }
        fullWidth
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Municipio"
          name="municipality"
          value={formData.municipality}
          onChange={onChange}
          error={formErrors.municipality}
          maxLength={100}
          helperText={isGeocoding ? 'Buscando municipio...' : undefined}
          fullWidth
        />
        <Input
          label="Barrio"
          name="neighborhood"
          value={formData.neighborhood}
          onChange={onChange}
          error={formErrors.neighborhood}
          maxLength={150}
          fullWidth
        />
      </div>

      {onCoordsPaste && (
        <Input
          label="Coordenadas (pegar desde Google Maps)"
          placeholder="Ej: 4.132689, -73.625153"
          value={coordsInput}
          onChange={handleCoordsPaste}
          error={coordsError}
          helperText={!coordsError && coordsInput ? 'Latitud y longitud completadas automáticamente' : undefined}
          fullWidth
        />
      )}

      <div className="grid grid-cols-3 gap-4">
        <Input
          label="Latitud"
          name="latitude"
          type="number"
          value={formData.latitude}
          onChange={onChange}
          error={formErrors.latitude}
          fullWidth
        />
        <Input
          label="Longitud"
          name="longitude"
          type="number"
          value={formData.longitude}
          onChange={onChange}
          error={formErrors.longitude}
          fullWidth
        />
        <Input
          label="Altitud (m)"
          name="altitude"
          type="number"
          value={formData.altitude}
          onChange={onChange}
          error={formErrors.altitude}
          helperText={isGeocoding ? 'Calculando...' : undefined}
          fullWidth
        />
      </div>
    </div>
  );
}
