'use client';

import React, { useEffect, useState } from 'react';
import { Combobox } from '@/components/ui';
import { apiService } from '@/services/api.service';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { DeviceResponseDTO, DeviceStatus } from '@/types/device.types';
import { deviceCategoryLabel } from '@/constants/device.constants';
import { cpeDeviceLabel } from './CpeDevicePicker';

const SEARCH_DEBOUNCE_MS = 300;
const RESULT_LIMIT = 50;
// A link can only be made to a device on the network (DEV-183).
const UPSTREAM_STATUSES: DeviceStatus[] = ['ACTIVE', 'COMMISSIONING'];

interface UpstreamDevicePickerProps {
  value: string;
  onChange: (deviceId: string) => void;
  /** The device behind `value` when the form opens, so its name shows even when it isn't in the current results. */
  selected?: DeviceResponseDTO | null;
  /** The device being edited, left out of the results: it cannot hang off itself. */
  excludeId?: string;
  error?: string;
  fullWidth?: boolean;
}

/**
 * Picks the device another one hangs off on the network — a CPE's AP, an AP's
 * switch — by searching the server for name, IP, serial or MAC among the
 * ACTIVE and COMMISSIONING devices. Empty means a root (`upstreamDeviceId: null`).
 */
export function UpstreamDevicePicker({ value, onChange, selected, excludeId, error, fullWidth }: UpstreamDevicePickerProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const [results, setResults] = useState<{ query: string; devices: DeviceResponseDTO[] } | null>(null);
  const isLoading = results?.query !== debouncedQuery || query.trim() !== debouncedQuery;
  const devices = (results?.devices ?? []).filter((d) => d.id !== excludeId);
  // The last device picked, so its name survives a new search that no longer lists it.
  const [picked, setPicked] = useState<DeviceResponseDTO | null>(null);
  const current = [picked, selected].find((d) => d && d.id === value) ?? null;

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      UPSTREAM_STATUSES.map((status) =>
        apiService.listDevices({ status, search: debouncedQuery || undefined, limit: RESULT_LIMIT, sortBy: 'name', sortOrder: 'ASC' })
      )
    ).then((responses) => {
      if (cancelled) return;
      setResults({ query: debouncedQuery, devices: responses.flatMap((r) => (r.success && r.data ? r.data.devices : [])) });
    });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const toOption = (d: DeviceResponseDTO) => ({
    value: d.id,
    label: cpeDeviceLabel(d),
    sublabel: d.category ? deviceCategoryLabel(d.category) : undefined,
  });
  const options = devices.map(toOption);
  if (current && !devices.some((d) => d.id === current.id)) options.unshift(toOption(current));

  return (
    <Combobox
      label="Depende de"
      value={value}
      onChange={(id) => {
        setPicked(devices.find((d) => d.id === id) ?? null);
        onChange(id);
      }}
      options={query.trim() ? options : [{ value: '', label: 'Ninguno (raíz de la red)' }, ...options]}
      onQueryChange={setQuery}
      isLoading={isLoading}
      placeholder="Buscar por nombre, IP, serie o MAC"
      info="El equipo del que depende en la red: el AP de un CPE, el switch de un AP, el router de un switch. Arma el mapa de red y evita que, si cae un AP, cada cliente detrás avise por separado."
      error={error}
      fullWidth={fullWidth}
    />
  );
}
