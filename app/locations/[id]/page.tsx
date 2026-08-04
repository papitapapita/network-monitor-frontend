'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { LocationResponseDTO, UpdateLocationDTO } from '@/types/location.types';
import { DeviceResponseDTO, DeviceStatus } from '@/types/device.types';
import { LOCATION_TYPE_LABELS, LOCATION_TYPE_BADGE_VARIANTS } from '@/constants/location.constants';
import { deviceCategoryLabel } from '@/constants/device.constants';
import { Button, Badge, LoadingSpinner, Card, Table, TableEmptyState } from '@/components/ui';
import { ConfirmModal } from '@/components/ui/Modal';
import {
  LocationForm,
  LocationFormData,
  EMPTY_LOCATION_FORM,
  validateLocationForm,
  buildLocationDTO,
  locationToForm,
  inferLocationFromCoords,
} from '@/components/locations/LocationForm';
import type { BadgeVariant } from '@/components/ui';

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

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [formData, setFormData] = useState<LocationFormData>(EMPTY_LOCATION_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
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
      setFormData(locationToForm(locResult.data));
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const cancelEdit = () => {
    if (location) setFormData(locationToForm(location));
    setFormErrors({});
    setIsEditing(false);
  };

  const handleSave = async () => {
    const errors = validateLocationForm(formData);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    setError(null);

    const dto: UpdateLocationDTO = buildLocationDTO(formData);
    const result = await apiService.updateLocation(locationId, dto);
    if (result.success && result.data) {
      setLocation(result.data);
      setFormData(locationToForm(result.data));
      setIsEditing(false);
    } else {
      setError(result.error || 'Error al actualizar la ubicación');
    }
    setIsSaving(false);
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 wrap-anywhere mb-2">{location.name}</h1>
            <Badge variant={LOCATION_TYPE_BADGE_VARIANTS[location.type]}>
              {LOCATION_TYPE_LABELS[location.type]}
            </Badge>
          </div>
        </div>
        <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
          Eliminar
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-6">
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex justify-end mb-3">
        {!isEditing ? (
          <Button variant="outline" onClick={() => setIsEditing(true)}>Editar</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={cancelEdit} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSave} isLoading={isSaving}>Guardar Cambios</Button>
          </div>
        )}
      </div>

      {isEditing ? (
        <Card className="mb-6">
          <Card.Header>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Editar Ubicación</h2>
          </Card.Header>
          <Card.Body>
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
          </Card.Body>
        </Card>
      ) : (
        <>
          {/* Details card */}
          <Card className="mb-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Información general</h2>
            <dl className="wrap-anywhere grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
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
            <dl className="wrap-anywhere grid grid-cols-2 gap-x-6 gap-y-4">
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
        </>
      )}

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
                      {deviceCategoryLabel(dev.category)}
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
