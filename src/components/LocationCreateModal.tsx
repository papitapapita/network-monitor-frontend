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
  useLocationCoordsGeocoding,
} from '@/components/locations/LocationForm';
import { useToast } from '@/contexts/toast.context';

interface LocationCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (location: LocationResponseDTO) => void;
}

export function LocationCreateModal({ isOpen, onClose, onCreated }: LocationCreateModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<LocationFormData>(EMPTY_LOCATION_FORM);
  const { isGeocoding, onLocationPick } = useLocationCoordsGeocoding(setFormData);
  const { showError, showFormErrors } = useToast();

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
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateLocationForm(formData);
    setFormErrors(errors);
    if (showFormErrors(errors)) return;

    setIsSubmitting(true);

    const result = await apiService.createLocation(buildLocationDTO(formData));
    if (result.success && result.data) {
      onCreated(result.data);
      handleClose();
    } else {
      showError(result.error || 'Error al crear la ubicación');
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
        <LocationForm
          formData={formData}
          formErrors={formErrors}
          onChange={handleChange}
          isGeocoding={isGeocoding}
          onLocationPick={onLocationPick}
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
