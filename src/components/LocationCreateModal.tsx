'use client';

import React, { useState } from 'react';
import { apiService } from '@/services/api.service';
import { LocationResponseDTO } from '@/types/location.types';
import { Modal, Button } from '@/components/ui';
import {
  LocationForm,
  LocationFormData,
  EMPTY_LOCATION_FORM,
  validateLocationForm,
  buildLocationDTO,
  inferLocationFromCoords,
} from '@/components/locations/LocationForm';

interface LocationCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (location: LocationResponseDTO) => void;
}

export function LocationCreateModal({ isOpen, onClose, onCreated }: LocationCreateModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<LocationFormData>(EMPTY_LOCATION_FORM);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const handleClose = () => {
    setFormData(EMPTY_LOCATION_FORM);
    setFormErrors({});
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateLocationForm(formData);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    setError(null);

    const result = await apiService.createLocation(buildLocationDTO(formData));
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
