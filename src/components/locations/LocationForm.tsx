'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Input, Select } from '@/components/ui';
import type { LocationType, LocationResponseDTO, CreateLocationDTO } from '@/types/location.types';
import { LOCATION_TYPE_OPTIONS } from '@/constants/location.constants';
import { reverseGeocode } from '@/services/geocoding.service';

const LocationPickerMap = dynamic(() => import('@/components/map/LocationPickerMap'), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
  ),
});

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

/**
 * Shared by the "click/drag on map" and "paste coordinates" inputs: both just
 * produce a lat/lon pair, so both should backfill the same way. Fields that
 * geocoding can't resolve are left untouched — the operator fills those in.
 */
export function useLocationCoordsGeocoding(
  setFormData: React.Dispatch<React.SetStateAction<LocationFormData>>,
) {
  const [isGeocoding, setIsGeocoding] = useState(false);

  const onLocationPick = async (lat: string, lon: string) => {
    setFormData((prev) => ({ ...prev, latitude: lat, longitude: lon }));
    setIsGeocoding(true);
    try {
      const inferred = await reverseGeocode(lat, lon);
      setFormData((prev) => ({
        ...prev,
        ...(inferred.road ? { address: inferred.road } : {}),
        ...(inferred.municipality ? { municipality: inferred.municipality } : {}),
        ...(inferred.neighborhood ? { neighborhood: inferred.neighborhood } : {}),
        ...(inferred.altitude != null ? { altitude: String(inferred.altitude) } : {}),
      }));
    } finally {
      setIsGeocoding(false);
    }
  };

  return { isGeocoding, onLocationPick };
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

  const hasAddress = !!formData.address.trim();
  const hasMunicipality = !!formData.municipality.trim();
  const hasNeighborhood = !!formData.neighborhood.trim();
  if ((hasAddress || hasMunicipality || hasNeighborhood) && !(hasAddress && hasMunicipality && hasNeighborhood)) {
    if (!errors.address && !hasAddress) errors.address = 'La dirección es requerida junto con el municipio y el barrio';
    if (!errors.municipality && !hasMunicipality) errors.municipality = 'El municipio es requerido junto con la dirección y el barrio';
    if (!errors.neighborhood && !hasNeighborhood) errors.neighborhood = 'El barrio es requerido junto con la dirección y el municipio';
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
  onLocationPick?: (lat: string, lon: string) => void;
  isGeocoding?: boolean;
}

export function LocationForm({ formData, formErrors, onChange, onLocationPick, isGeocoding }: LocationFormProps) {
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
      onLocationPick?.(parsed.lat, parsed.lon);
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

      {onLocationPick && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Ubicar en el mapa
          </label>
          <LocationPickerMap
            latitude={formData.latitude}
            longitude={formData.longitude}
            onPick={(lat, lon) => onLocationPick(String(lat), String(lon))}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {isGeocoding
              ? 'Completando datos desde el mapa...'
              : 'Haga clic o arrastre el marcador para ubicar el punto exacto. Se completará lo que se pueda inferir; el resto queda en blanco para usted.'}
          </p>
        </div>
      )}

      <Input
        label="Dirección"
        name="address"
        value={formData.address}
        onChange={onChange}
        error={formErrors.address}
        maxLength={255}
        helperText={
          formData.type === 'CUSTOMER_PREMISES'
            ? 'Una instalación de cliente requiere dirección o coordenadas. Dirección, municipio y barrio van juntos.'
            : 'Dirección, municipio y barrio van juntos: si completa uno, debe completar los tres.'
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

      {onLocationPick && (
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
