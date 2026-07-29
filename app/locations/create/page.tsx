'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { Card, Button } from '@/components/ui';
import {
  LocationForm,
  LocationFormData,
  EMPTY_LOCATION_FORM,
  validateLocationForm,
  buildLocationDTO,
  inferLocationFromCoords,
} from '@/components/locations/LocationForm';

export default function CreateLocationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateLocationForm(formData);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    setError(null);

    const result = await apiService.createLocation(buildLocationDTO(formData));
    if (result.success && result.data) {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      router.replace(`/locations/${result.data.id}`);
    } else {
      setError(result.error || 'Error al crear la ubicación');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            ← Atrás
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Agregar Ubicación</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Registra una nueva ubicación de la red</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Información de la Ubicación</h2>
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

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Crear Ubicación
          </Button>
        </div>
      </form>
    </div>
  );
}
