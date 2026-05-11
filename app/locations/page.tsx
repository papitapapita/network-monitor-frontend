'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
} from '@/components/ui';
import type { BadgeVariant } from '@/components/ui';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const PAGE_LIMIT = 20;

const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  TOWER: 'Torre',
  NODE: 'Nodo',
  DATACENTER: 'Datacenter',
  POP: 'POP',
  WAREHOUSE: 'Bodega',
  OFFICE: 'Oficina',
};

const LOCATION_TYPE_BADGE_VARIANTS: Record<LocationType, BadgeVariant> = {
  TOWER: 'info',
  NODE: 'active',
  DATACENTER: 'warning',
  POP: 'draft',
  WAREHOUSE: 'neutral',
  OFFICE: 'neutral',
};

const LOCATION_TYPE_OPTIONS = [
  { value: '', label: 'Seleccionar tipo' },
  { value: 'TOWER', label: 'Torre' },
  { value: 'NODE', label: 'Nodo' },
  { value: 'DATACENTER', label: 'Datacenter' },
  { value: 'POP', label: 'POP' },
  { value: 'WAREHOUSE', label: 'Bodega' },
  { value: 'OFFICE', label: 'Oficina' },
];

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
}

function LocationForm({ formData, formErrors, onChange }: LocationFormProps) {
  return (
    <div className="space-y-4">
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
        <LocationForm formData={formData} formErrors={formErrors} onChange={handleChange} />
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
        <LocationForm formData={formData} formErrors={formErrors} onChange={handleChange} />
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
  const [locations, setLocations] = useState<LocationResponseDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationResponseDTO | null>(null);

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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleCreated = (loc: LocationResponseDTO) => {
    setShowCreateModal(false);
    // If we're on a page that could include the new item, refresh
    loadLocations(currentPage);
  };

  const handleUpdated = (updated: LocationResponseDTO) => {
    setLocations((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setEditingLocation(null);
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
        ) : locations.length === 0 ? (
          <div className="text-center py-16">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm">
              No hay ubicaciones registradas
            </p>
            <Button className="mt-4" size="sm" onClick={() => setShowCreateModal(true)}>
              Crear primera ubicación
            </Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    {['Nombre', 'Tipo', 'Municipio', 'Barrio', 'Dirección', 'Acciones'].map(
                      (col) => (
                        <th
                          key={col}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                        >
                          {col}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {locations.map((loc) => (
                    <tr
                      key={loc.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {loc.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={LOCATION_TYPE_BADGE_VARIANTS[loc.type]}>
                          {LOCATION_TYPE_LABELS[loc.type]}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {loc.municipality ?? '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {loc.neighborhood ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate">
                        {loc.address ?? '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingLocation(loc)}
                          >
                            Editar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
    </div>
  );
}
