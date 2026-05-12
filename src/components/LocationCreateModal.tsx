'use client';

import React, { useState } from 'react';
import { apiService } from '@/services/api.service';
import { CreateLocationDTO, LocationResponseDTO, LocationType } from '@/types/location.types';
import { Modal, Button, Input, Select } from '@/components/ui';

const LOCATION_TYPE_OPTIONS = [
  { value: '', label: 'Seleccionar tipo' },
  { value: 'TOWER', label: 'Torre' },
  { value: 'NODE', label: 'Nodo' },
  { value: 'DATACENTER', label: 'Datacenter' },
  { value: 'POP', label: 'POP' },
  { value: 'WAREHOUSE', label: 'Bodega' },
  { value: 'OFFICE', label: 'Oficina' },
];

interface LocationCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (location: LocationResponseDTO) => void;
}

export function LocationCreateModal({ isOpen, onClose, onCreated }: LocationCreateModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: '',
    type: '' as LocationType | '',
    municipality: '',
    neighborhood: '',
    address: '',
    latitude: '',
    longitude: '',
    altitude: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const handleClose = () => {
    setFormData({ name: '', type: '', municipality: '', neighborhood: '', address: '', latitude: '', longitude: '', altitude: '' });
    setFormErrors({});
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'El nombre es requerido';
    if (!formData.type) errors.type = 'El tipo es requerido';
    const lat = parseFloat(formData.latitude);
    const lon = parseFloat(formData.longitude);
    if ((formData.latitude && !formData.longitude) || (!formData.latitude && formData.longitude)) {
      errors.latitude = 'Latitud y longitud deben indicarse juntas';
    }
    if (formData.latitude && (lat < -90 || lat > 90)) errors.latitude = 'Debe estar entre -90 y 90';
    if (formData.longitude && (lon < -180 || lon > 180)) errors.longitude = 'Debe estar entre -180 y 180';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    setError(null);

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

    const result = await apiService.createLocation(dto);
    if (result.success && result.data) {
      onCreated(result.data);
      handleClose();
    } else {
      setError(result.error || 'Error al crear la ubicación');
    }
    setIsSubmitting(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Nueva Ubicación"
      size="lg"
      transparentBackdrop
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombre"
              name="name"
              value={formData.name}
              onChange={handleChange}
              error={formErrors.name}
              required
              fullWidth
            />
            <Select
              label="Tipo"
              name="type"
              value={formData.type}
              onChange={handleChange}
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
            onChange={handleChange}
            fullWidth
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Municipio"
              name="municipality"
              value={formData.municipality}
              onChange={handleChange}
              fullWidth
            />
            <Input
              label="Barrio"
              name="neighborhood"
              value={formData.neighborhood}
              onChange={handleChange}
              fullWidth
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Latitud"
              name="latitude"
              type="number"
              value={formData.latitude}
              onChange={handleChange}
              error={formErrors.latitude}
              fullWidth
            />
            <Input
              label="Longitud"
              name="longitude"
              type="number"
              value={formData.longitude}
              onChange={handleChange}
              error={formErrors.longitude}
              fullWidth
            />
            <Input
              label="Altitud (m)"
              name="altitude"
              type="number"
              value={formData.altitude}
              onChange={handleChange}
              fullWidth
            />
          </div>
        </div>

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
