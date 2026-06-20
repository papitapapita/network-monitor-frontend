'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api.service';
import {
  LocationResponseDTO,
  LocationType,
  CreateLocationDTO,
  UpdateLocationDTO,
} from '@/types/location.types';
import {
  Card,
  Button,
  Input,
  Select,
  Modal,
  Badge,
  LoadingSpinner,
  Pagination,
  Table,
  TableEmptyState,
} from '@/components/ui';
import { ConfirmModal } from '@/components/ui/Modal';
import type { BadgeVariant } from '@/components/ui';
import { inferLocationFromCoords } from '@/components/locations/LocationForm';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const PAGE_LIMIT = 20;

const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  TOWER: 'Torre',
  DATACENTER: 'Datacenter',
  POINT_OF_PRESENCE: 'Punto de Presencia',
  OFFICE: 'Oficina',
  CUSTOMER_PREMISES: 'Instalación Cliente',
  OTHER: 'Otro',
};

const LOCATION_TYPE_BADGE_VARIANTS: Record<LocationType, BadgeVariant> = {
  TOWER: 'info',
  DATACENTER: 'warning',
  POINT_OF_PRESENCE: 'draft',
  OFFICE: 'neutral',
  CUSTOMER_PREMISES: 'neutral',
  OTHER: 'neutral',
};

const LOCATION_TYPE_OPTIONS = [
  { value: '', label: 'Seleccionar tipo' },
  { value: 'TOWER', label: 'Torre' },
  { value: 'DATACENTER', label: 'Datacenter' },
  { value: 'POINT_OF_PRESENCE', label: 'Punto de Presencia' },
  { value: 'OFFICE', label: 'Oficina' },
  { value: 'CUSTOMER_PREMISES', label: 'Instalación de cliente' },
  { value: 'OTHER', label: 'Otro' },
];

// ─────────────────────────────────────────────
// Pretty Checkbox
// ─────────────────────────────────────────────

interface SelectCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label?: string;
}

function SelectCheckbox({ checked, indeterminate = false, onChange, label }: SelectCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={`
        w-[18px] h-[18px] rounded border-2 flex items-center justify-center shrink-0
        transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
        dark:focus:ring-offset-gray-800
        ${(checked || indeterminate)
          ? 'bg-blue-600 border-blue-600 shadow-sm'
          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 bg-white dark:bg-gray-800'
        }
      `}
    >
      {indeterminate && !checked && (
        <div className="w-2 h-px bg-white rounded-full" />
      )}
      {checked && (
        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5l2.5 2.5 4.5-4.5" />
        </svg>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────
// Location form (shared by create & edit)
// ─────────────────────────────────────────────

interface LocationFormData {
  name: string;
  type: LocationType | '';
  municipality: string;
  neighborhood: string;
  address: string;
  latitude: string;
  longitude: string;
  altitude: string;
}

const EMPTY_FORM: LocationFormData = {
  name: '',
  type: '',
  municipality: '',
  neighborhood: '',
  address: '',
  latitude: '',
  longitude: '',
  altitude: '',
};

interface LocationFormProps {
  formData: LocationFormData;
  formErrors: Record<string, string>;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onCoordsPaste?: (lat: string, lon: string) => void;
  isGeocoding?: boolean;
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

function LocationForm({ formData, formErrors, onChange, onCoordsPaste, isGeocoding }: LocationFormProps) {
  const [coordsInput, setCoordsInput] = React.useState('');
  const [coordsError, setCoordsError] = React.useState('');

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
        fullWidth
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Municipio"
          name="municipality"
          value={formData.municipality}
          onChange={onChange}
          helperText={isGeocoding ? 'Buscando municipio...' : undefined}
          fullWidth
        />
        <Input
          label="Barrio"
          name="neighborhood"
          value={formData.neighborhood}
          onChange={onChange}
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
          helperText={isGeocoding ? 'Calculando...' : undefined}
          fullWidth
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Validation helper
// ─────────────────────────────────────────────

function validateLocationForm(formData: LocationFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!formData.name.trim()) errors.name = 'El nombre es requerido';
  if (!formData.type) errors.type = 'El tipo es requerido';
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
  return errors;
}

function buildDTO(formData: LocationFormData): CreateLocationDTO {
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

function locationToForm(loc: LocationResponseDTO): LocationFormData {
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

// ─────────────────────────────────────────────
// Create Modal
// ─────────────────────────────────────────────

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (loc: LocationResponseDTO) => void;
}

function CreateLocationModal({ isOpen, onClose, onCreated }: CreateModalProps) {
  const [formData, setFormData] = useState<LocationFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setError(null);
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateLocationForm(formData);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    setError(null);

    const result = await apiService.createLocation(buildDTO(formData));
    if (result.success && result.data) {
      onCreated(result.data);
      handleClose();
    } else {
      setError(result.error || 'Error al crear la ubicación');
    }
    setIsSubmitting(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Nueva Ubicación" size="lg">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}
        <LocationForm
          formData={formData}
          formErrors={formErrors}
          onChange={handleChange}
          isGeocoding={isGeocoding}
          onCoordsPaste={async (lat, lon) => {
            setFormData((prev) => ({ ...prev, latitude: lat, longitude: lon }));
            setIsGeocoding(true);
            try {
              const inferred = await inferLocationFromCoords(lat, lon);
              setFormData((prev) => ({
                ...prev,
                ...(inferred.municipality ? { municipality: inferred.municipality } : {}),
                ...(inferred.altitude != null ? { altitude: String(inferred.altitude) } : {}),
              }));
            } finally {
              setIsGeocoding(false);
            }
          }}
        />
        <Modal.Footer>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Crear Ubicación
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Edit Modal
// ─────────────────────────────────────────────

interface EditModalProps {
  location: LocationResponseDTO | null;
  onClose: () => void;
  onUpdated: (loc: LocationResponseDTO) => void;
}

function EditLocationModal({ location, onClose, onUpdated }: EditModalProps) {
  const [formData, setFormData] = useState<LocationFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (location) {
      setFormData(locationToForm(location));
      setFormErrors({});
      setError(null);
    }
  }, [location]);

  const handleClose = () => {
    setFormErrors({});
    setError(null);
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) return;

    const errors = validateLocationForm(formData);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    setError(null);

    const dto: UpdateLocationDTO = buildDTO(formData);
    const result = await apiService.updateLocation(location.id, dto);
    if (result.success && result.data) {
      onUpdated(result.data);
      handleClose();
    } else {
      setError(result.error || 'Error al actualizar la ubicación');
    }
    setIsSubmitting(false);
  };

  return (
    <Modal isOpen={!!location} onClose={handleClose} title="Editar Ubicación" size="lg">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}
        <LocationForm
          formData={formData}
          formErrors={formErrors}
          onChange={handleChange}
          isGeocoding={isGeocoding}
          onCoordsPaste={async (lat, lon) => {
            setFormData((prev) => ({ ...prev, latitude: lat, longitude: lon }));
            setIsGeocoding(true);
            try {
              const inferred = await inferLocationFromCoords(lat, lon);
              setFormData((prev) => ({
                ...prev,
                ...(inferred.municipality ? { municipality: inferred.municipality } : {}),
                ...(inferred.altitude != null ? { altitude: String(inferred.altitude) } : {}),
              }));
            } finally {
              setIsGeocoding(false);
            }
          }}
        />
        <Modal.Footer>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Guardar Cambios
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function LocationsPage() {
  const router = useRouter();
  const [locations, setLocations] = useState<LocationResponseDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationResponseDTO | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Selection & delete state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedLocations = sortField
    ? [...locations].sort((a, b) => {
        let aVal = '';
        let bVal = '';
        if (sortField === 'name') { aVal = a.name; bVal = b.name; }
        else if (sortField === 'type') { aVal = a.type; bVal = b.type; }
        else if (sortField === 'municipality') { aVal = a.municipality ?? ''; bVal = b.municipality ?? ''; }
        else if (sortField === 'neighborhood') { aVal = a.neighborhood ?? ''; bVal = b.neighborhood ?? ''; }
        else if (sortField === 'address') { aVal = a.address ?? ''; bVal = b.address ?? ''; }
        const cmp = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? cmp : -cmp;
      })
    : locations;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const loadLocations = useCallback(async (page: number) => {
    setIsLoading(true);
    setPageError(null);
    const result = await apiService.listLocations({
      limit: PAGE_LIMIT,
      offset: (page - 1) * PAGE_LIMIT,
    });
    if (result.success && result.data) {
      setLocations(result.data.locations);
      setTotal(result.data.total);
    } else {
      setPageError(result.error || 'Error al cargar las ubicaciones');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadLocations(currentPage);
  }, [currentPage, loadLocations]);

  // Clear selection when page changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentPage]);

  const handlePageChange = (page: number) => setCurrentPage(page);

  const handleCreated = (_loc: LocationResponseDTO) => {
    setShowCreateModal(false);
    loadLocations(currentPage);
  };

  const handleUpdated = (updated: LocationResponseDTO) => {
    setLocations((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setEditingLocation(null);
  };

  // ── Selection helpers ────────────────────────────────────────

  const pageIds = sortedLocations.map((l) => l.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Delete handler ───────────────────────────────────────────

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const results = await Promise.all(ids.map((id) => apiService.deleteLocation(id)));
      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) {
        const firstError = failed[0].error ?? 'Error desconocido';
        setPageError(
          failed.length === ids.length
            ? firstError
            : `Se eliminaron ${ids.length - failed.length} de ${ids.length} ubicaciones. Error: ${firstError}`
        );
      } else {
        setSelectedIds(new Set());
      }
      setShowBulkDeleteConfirm(false);
      await loadLocations(currentPage);
    } catch {
      setPageError('Error al eliminar las ubicaciones');
      setShowBulkDeleteConfirm(false);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Ubicaciones</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gestiona las ubicaciones de la red
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          + Nueva Ubicación
        </Button>
      </div>

      {/* Error */}
      {pageError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{pageError}</p>
        </div>
      )}

      {/* Table card */}
      <Card padding="none">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner message="Cargando ubicaciones..." />
          </div>
        ) : (
          <>
            <Table>
              <Table.Header>
                <Table.Head className="w-10 pl-4 pr-0">
                  <SelectCheckbox
                    checked={allPageSelected}
                    indeterminate={somePageSelected && !allPageSelected}
                    onChange={toggleSelectAll}
                    label="Seleccionar todo"
                  />
                </Table.Head>
                <Table.Head sortable onSort={() => handleSort('name')} sortDirection={sortField === 'name' ? sortDirection : null}>Nombre</Table.Head>
                <Table.Head sortable onSort={() => handleSort('type')} sortDirection={sortField === 'type' ? sortDirection : null}>Tipo</Table.Head>
                <Table.Head sortable onSort={() => handleSort('municipality')} sortDirection={sortField === 'municipality' ? sortDirection : null} className="hidden sm:table-cell">Municipio</Table.Head>
                <Table.Head sortable onSort={() => handleSort('neighborhood')} sortDirection={sortField === 'neighborhood' ? sortDirection : null} className="hidden md:table-cell">Barrio</Table.Head>
                <Table.Head sortable onSort={() => handleSort('address')} sortDirection={sortField === 'address' ? sortDirection : null} className="hidden lg:table-cell">Dirección</Table.Head>
                <Table.Head>{''}</Table.Head>
              </Table.Header>
              <Table.Body>
                {sortedLocations.length === 0 ? (
                  <TableEmptyState message="No hay ubicaciones registradas" />
                ) : (
                  sortedLocations.map((loc) => {
                    const isSelected = selectedIds.has(loc.id);
                    return (
                      <Table.Row
                        key={loc.id}
                        onClick={() => router.push(`/locations/${loc.id}`)}
                        className={isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : ''}
                      >
                        <Table.Cell className="w-10 pl-4 pr-0">
                          <SelectCheckbox
                            checked={isSelected}
                            onChange={() => toggleSelect(loc.id)}
                            label={`Seleccionar ${loc.name}`}
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <span className="font-medium">{loc.name}</span>
                          {loc.address && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 lg:hidden truncate max-w-[12rem]">{loc.address}</div>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <Badge variant={LOCATION_TYPE_BADGE_VARIANTS[loc.type]}>
                            {LOCATION_TYPE_LABELS[loc.type]}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell className="hidden sm:table-cell text-gray-600 dark:text-gray-300">
                          {loc.municipality ?? '—'}
                        </Table.Cell>
                        <Table.Cell className="hidden md:table-cell text-gray-600 dark:text-gray-300">
                          {loc.neighborhood ?? '—'}
                        </Table.Cell>
                        <Table.Cell className="hidden lg:table-cell text-gray-600 dark:text-gray-300 max-w-xs">
                          <span className="block truncate">{loc.address ?? '—'}</span>
                        </Table.Cell>
                        <Table.Cell>
                          <div onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="outline" onClick={() => setEditingLocation(loc)}>
                              Editar
                            </Button>
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })
                )}
              </Table.Body>
            </Table>

            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                totalItems={total}
                itemsPerPage={PAGE_LIMIT}
              />
            )}
          </>
        )}
      </Card>

      {/* Floating bulk-action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 bg-gray-900 dark:bg-gray-950 text-white rounded-2xl shadow-2xl px-5 py-3 border border-gray-700 dark:border-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-white leading-none">{selectedIds.size}</span>
              </div>
              <span className="text-sm font-medium">
                {selectedIds.size === 1 ? '1 seleccionada' : `${selectedIds.size} seleccionadas`}
              </span>
            </div>
            <div className="h-4 w-px bg-gray-600" />
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors"
            >
              Eliminar
            </button>
            <div className="h-4 w-px bg-gray-600" />
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateLocationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleCreated}
      />
      <EditLocationModal
        location={editingLocation}
        onClose={() => setEditingLocation(null)}
        onUpdated={handleUpdated}
      />
      <ConfirmModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title="Eliminar ubicaciones"
        message={`¿Estás seguro de que deseas eliminar ${selectedIds.size} ubicaci${selectedIds.size === 1 ? 'ón' : 'ones'}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isBulkDeleting}
      />
    </div>
  );
}
