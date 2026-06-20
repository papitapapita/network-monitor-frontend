'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { LocationResponseDTO, LocationType, UpdateLocationDTO, CreateLocationDTO } from '@/types/location.types';
import { DeviceResponseDTO, DeviceStatus } from '@/types/device.types';
import { Button, Badge, LoadingSpinner, Card, Input, Select, Modal, Table, TableEmptyState } from '@/components/ui';
import { inferLocationFromCoords } from '@/components/locations/LocationForm';
import { ConfirmModal } from '@/components/ui/Modal';
import type { BadgeVariant } from '@/components/ui';

// ─────────────────────────────────────────────
// Constants (same as list page — kept local)
// ─────────────────────────────────────────────

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

const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  ACTIVE: 'Activo',
  COMMISSIONING: 'Comisionamiento',
  INVENTORY: 'Inventario',
  DAMAGED: 'Dañado',
};

const DEVICE_STATUS_VARIANTS: Record<DeviceStatus, BadgeVariant> = {
  ACTIVE: 'active',
  COMMISSIONING: 'info',
  INVENTORY: 'neutral',
  DAMAGED: 'warning',
};

// ─────────────────────────────────────────────
// Edit form helpers
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
  name: '', type: '', municipality: '', neighborhood: '',
  address: '', latitude: '', longitude: '', altitude: '',
};

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

function parseCoords(raw: string): { lat: string; lon: string } | null {
  const parts = raw.split(',').map((s) => s.trim());
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat: String(lat), lon: String(lon) };
}

function validateForm(f: LocationFormData): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!f.name.trim()) errs.name = 'El nombre es requerido';
  if (!f.type) errs.type = 'El tipo es requerido';
  if ((f.latitude && !f.longitude) || (!f.latitude && f.longitude))
    errs.latitude = 'Latitud y longitud deben indicarse juntas';
  const lat = parseFloat(f.latitude);
  const lon = parseFloat(f.longitude);
  if (f.latitude && (lat < -90 || lat > 90)) errs.latitude = 'Debe estar entre -90 y 90';
  if (f.longitude && (lon < -180 || lon > 180)) errs.longitude = 'Debe estar entre -180 y 180';
  return errs;
}

function buildDTO(f: LocationFormData): CreateLocationDTO {
  const dto: CreateLocationDTO = { name: f.name.trim(), type: f.type as LocationType };
  if (f.municipality.trim()) dto.municipality = f.municipality.trim();
  if (f.neighborhood.trim()) dto.neighborhood = f.neighborhood.trim();
  if (f.address.trim()) dto.address = f.address.trim();
  if (f.latitude) dto.latitude = parseFloat(f.latitude);
  if (f.longitude) dto.longitude = parseFloat(f.longitude);
  if (f.altitude) dto.altitude = parseFloat(f.altitude);
  return dto;
}

// ─────────────────────────────────────────────
// Edit Modal (inline here, self-contained)
// ─────────────────────────────────────────────

interface EditModalProps {
  isOpen: boolean;
  location: LocationResponseDTO;
  onClose: () => void;
  onUpdated: (loc: LocationResponseDTO) => void;
}

function EditLocationModal({ isOpen, location, onClose, onUpdated }: EditModalProps) {
  const [formData, setFormData] = useState<LocationFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coordsInput, setCoordsInput] = useState('');
  const [coordsError, setCoordsError] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(locationToForm(location));
      setFormErrors({});
      setError(null);
      setCoordsInput('');
      setCoordsError('');
    }
  }, [isOpen, location]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
  };

  const handleCoordsPaste = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setCoordsInput(raw);
    if (!raw.trim()) { setCoordsError(''); return; }
    const parsed = parseCoords(raw);
    if (parsed) {
      setCoordsError('');
      setFormData((prev) => ({ ...prev, latitude: parsed.lat, longitude: parsed.lon }));
      setIsGeocoding(true);
      try {
        const inferred = await inferLocationFromCoords(parsed.lat, parsed.lon);
        setFormData((prev) => ({
          ...prev,
          ...(inferred.municipality ? { municipality: inferred.municipality } : {}),
          ...(inferred.altitude != null ? { altitude: String(inferred.altitude) } : {}),
        }));
      } finally {
        setIsGeocoding(false);
      }
    } else {
      setCoordsError('Formato inválido. Ej: 4.132689, -73.625153');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateForm(formData);
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsSubmitting(true);
    setError(null);
    const dto: UpdateLocationDTO = buildDTO(formData);
    const result = await apiService.updateLocation(location.id, dto);
    setIsSubmitting(false);

    if (result.success && result.data) {
      onUpdated(result.data);
      onClose();
    } else {
      setError(result.error || 'Error al actualizar la ubicación');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Ubicación" size="lg">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nombre" name="name" value={formData.name} onChange={handleChange} error={formErrors.name} required fullWidth />
            <Select label="Tipo" name="type" value={formData.type} onChange={handleChange} options={LOCATION_TYPE_OPTIONS} error={formErrors.type} required fullWidth />
          </div>
          <Input label="Dirección" name="address" value={formData.address} onChange={handleChange} fullWidth />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Municipio" name="municipality" value={formData.municipality} onChange={handleChange} helperText={isGeocoding ? 'Buscando municipio...' : undefined} fullWidth />
            <Input label="Barrio" name="neighborhood" value={formData.neighborhood} onChange={handleChange} fullWidth />
          </div>
          <Input
            label="Coordenadas (pegar desde Google Maps)"
            placeholder="Ej: 4.132689, -73.625153"
            value={coordsInput}
            onChange={handleCoordsPaste}
            error={coordsError}
            helperText={!coordsError && coordsInput ? 'Latitud y longitud actualizadas' : undefined}
            fullWidth
          />
          <div className="grid grid-cols-3 gap-4">
            <Input label="Latitud" name="latitude" type="number" value={formData.latitude} onChange={handleChange} error={formErrors.latitude} fullWidth />
            <Input label="Longitud" name="longitude" type="number" value={formData.longitude} onChange={handleChange} error={formErrors.longitude} fullWidth />
            <Input label="Altitud (m)" name="altitude" type="number" value={formData.altitude} onChange={handleChange} helperText={isGeocoding ? 'Calculando...' : undefined} fullWidth />
          </div>
        </div>

        <Modal.Footer>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button type="submit" isLoading={isSubmitting}>Guardar Cambios</Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Detail field helper
// ─────────────────────────────────────────────

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</dt>
      <dd className="text-sm text-gray-900 dark:text-gray-100">{value ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</dd>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function LocationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const locationId = params.id as string;

  const [location, setLocation] = useState<LocationResponseDTO | null>(null);
  const [devices, setDevices] = useState<DeviceResponseDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const [locResult, devResult] = await Promise.all([
      apiService.getLocation(locationId),
      apiService.listDevices({ locationId, limit: 100 }),
    ]);

    if (locResult.success && locResult.data) {
      setLocation(locResult.data);
    } else {
      setError(locResult.error || 'Error al cargar la ubicación');
    }

    if (devResult.success && devResult.data) {
      setDevices(devResult.data.devices);
    }

    setIsLoading(false);
  }, [locationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdated = (updated: LocationResponseDTO) => {
    setLocation(updated);
    setShowEditModal(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await apiService.deleteLocation(locationId);
    setIsDeleting(false);
    if (result.success) {
      router.push('/locations');
    } else {
      setError(result.error || 'Error al eliminar la ubicación');
      setShowDeleteModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner size="lg" message="Cargando ubicación..." />
      </div>
    );
  }

  if (error && !location) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400 mb-4">{error}</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push('/locations')}>Volver a Ubicaciones</Button>
            <Button onClick={fetchData}>Reintentar</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!location) return null;

  const hasCoords = location.latitude != null && location.longitude != null;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
    : null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Modals */}
      <EditLocationModal
        isOpen={showEditModal}
        location={location}
        onClose={() => setShowEditModal(false)}
        onUpdated={handleUpdated}
      />
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Eliminar ubicación"
        message={`¿Estás seguro de que deseas eliminar "${location.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/locations')}>
            ← Ubicaciones
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">{location.name}</h1>
            <Badge variant={LOCATION_TYPE_BADGE_VARIANTS[location.type]}>
              {LOCATION_TYPE_LABELS[location.type]}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>
            Editar
          </Button>
          <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
            Eliminar
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-6">
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Details card */}
      <Card className="mb-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Información general</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
          <DetailField label="Municipio" value={location.municipality} />
          <DetailField label="Barrio" value={location.neighborhood} />
          <DetailField label="Dirección" value={location.address} />
          <DetailField
            label="Latitud"
            value={location.latitude != null ? location.latitude.toFixed(6) : null}
          />
          <DetailField
            label="Longitud"
            value={location.longitude != null ? location.longitude.toFixed(6) : null}
          />
          <DetailField
            label="Altitud"
            value={location.altitude != null ? `${location.altitude} m` : null}
          />
        </dl>

        {hasCoords && mapsUrl && (
          <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Ver en Google Maps
            </a>
          </div>
        )}
      </Card>

      {/* Timestamps */}
      <Card className="mb-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          <DetailField
            label="Creada"
            value={new Date(location.createdAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
          />
          <DetailField
            label="Última actualización"
            value={new Date(location.updatedAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
          />
        </dl>
      </Card>

      {/* Devices section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Dispositivos
            {devices.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">({devices.length})</span>
            )}
          </h2>
          <Button size="sm" onClick={() => router.push(`/devices?locationId=${locationId}`)}>
            Ver todos
          </Button>
        </div>
        <Card padding="none">
          <Table>
            <Table.Header>
              <Table.Head>Nombre</Table.Head>
              <Table.Head>Estado</Table.Head>
              <Table.Head className="hidden sm:table-cell">IP</Table.Head>
              <Table.Head className="hidden md:table-cell">Categoría</Table.Head>
              <Table.Head>{''}</Table.Head>
            </Table.Header>
            <Table.Body>
              {devices.length === 0 ? (
                <TableEmptyState message="No hay dispositivos en esta ubicación" />
              ) : (
                devices.map((dev) => (
                  <Table.Row
                    key={dev.id}
                    onClick={() => router.push(`/devices/${dev.id}`)}
                  >
                    <Table.Cell>
                      <span className="font-medium">{dev.name}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={DEVICE_STATUS_VARIANTS[dev.status]}>
                        {DEVICE_STATUS_LABELS[dev.status]}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className="hidden sm:table-cell text-gray-600 dark:text-gray-300">
                      {dev.ipAddress ?? '—'}
                    </Table.Cell>
                    <Table.Cell className="hidden md:table-cell text-gray-600 dark:text-gray-300">
                      {dev.category ? dev.category.replace(/_/g, ' ') : '—'}
                    </Table.Cell>
                    <Table.Cell>
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); router.push(`/devices/${dev.id}`); }}>
                        Ver
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>
        </Card>
      </div>
    </div>
  );
}
