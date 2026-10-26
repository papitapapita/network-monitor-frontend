'use client';

import React, { useEffect, useState } from 'react';
import { Combobox } from '@/components/ui';
import { apiService } from '@/services/api.service';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { DeviceCategory, DeviceResponseDTO } from '@/types/device.types';

const SEARCH_DEBOUNCE_MS = 300;
// Per category. The server does the matching, so the list only has to hold
// what the operator is narrowing down to, not every CPE in the network.
const RESULT_LIMIT = 50;
const CPE_CATEGORIES: DeviceCategory[] = ['CPE', 'WIRELESS_CPE'];

export const cpeDeviceLabel = (d: DeviceResponseDTO) => `${d.name}${d.ipAddress ? ` – ${d.ipAddress}` : ''}`;

interface CpeDevicePickerProps {
  label: string;
  value: string;
  onChange: (deviceId: string) => void;
  /** The device behind `value`, so its name shows even when it isn't in the current results. */
  selected: DeviceResponseDTO | null;
  /** Every device the search returns, for callers that keep a lookup of names. */
  onDevicesFound?: (devices: DeviceResponseDTO[]) => void;
  fullWidth?: boolean;
}

/** Picks a CPE or wireless CPE by searching the server for name, IP, serial or MAC. */
export function CpeDevicePicker({ label, value, onChange, selected, onDevicesFound, fullWidth }: CpeDevicePickerProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  // Tagged with the query they answer, so a pending search shows as loading.
  const [results, setResults] = useState<{ query: string; devices: DeviceResponseDTO[] } | null>(null);
  const isLoading = results?.query !== debouncedQuery || query.trim() !== debouncedQuery;
  const devices = results?.devices ?? [];

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      CPE_CATEGORIES.map((category) =>
        apiService.listDevices({ category, search: debouncedQuery || undefined, limit: RESULT_LIMIT, sortBy: 'name', sortOrder: 'ASC' })
      )
    ).then((responses) => {
      if (cancelled) return;
      const found = responses.flatMap((r) => (r.success && r.data ? r.data.devices : []));
      setResults({ query: debouncedQuery, devices: found });
      onDevicesFound?.(found);
    });
    return () => { cancelled = true; };
  }, [debouncedQuery, onDevicesFound]);

  const options = devices.map((d) => ({ value: d.id, label: cpeDeviceLabel(d) }));
  if (selected && !devices.some((d) => d.id === selected.id)) {
    options.unshift({ value: selected.id, label: cpeDeviceLabel(selected) });
  }

  return (
    <Combobox
      label={label}
      value={value}
      onChange={onChange}
      // Kept out of a search so a query with no matches reads "Sin resultados".
      options={query.trim() ? options : [{ value: '', label: 'Sin dispositivo' }, ...options]}
      onQueryChange={setQuery}
      isLoading={isLoading}
      placeholder="Buscar por nombre, IP, serie o MAC"
      fullWidth={fullWidth}
    />
  );
}
