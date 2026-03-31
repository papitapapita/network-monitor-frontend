'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { CreateLocationDTO, LocationType } from '@/types/device.types';
import { Card, Button, Input, Select } from '@/components/ui';

export default function CreateLocationPage() {
  const router = useRouter();
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
    altitude: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.type) errors.type = 'Type is required';
    const lat = parseFloat(formData.latitude);
    const lon = parseFloat(formData.longitude);
    if ((formData.latitude && !formData.longitude) || (!formData.latitude && formData.longitude)) {
      errors.latitude = 'Latitude and longitude must both be provided';
    }
    if (formData.latitude && (lat < -90 || lat > 90)) errors.latitude = 'Latitude must be between -90 and 90';
    if (formData.longitude && (lon < -180 || lon > 180)) errors.longitude = 'Longitude must be between -180 and 180';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setError(null);

    const dto: CreateLocationDTO = {
      name: formData.name.trim(),
      type: formData.type as LocationType
    };

    if (formData.municipality.trim()) dto.municipality = formData.municipality.trim();
    if (formData.neighborhood.trim()) dto.neighborhood = formData.neighborhood.trim();
    if (formData.address.trim()) dto.address = formData.address.trim();
    if (formData.latitude) dto.latitude = parseFloat(formData.latitude);
    if (formData.longitude) dto.longitude = parseFloat(formData.longitude);
    if (formData.altitude) dto.altitude = parseFloat(formData.altitude);

    const result = await apiService.createLocation(dto);
    if (result.success && result.data) {
      router.push(`/locations/${result.data.id}`);
    } else {
      setError(result.error || 'Failed to create location');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            ← Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Add Location</h1>
        </div>
        <p className="text-gray-600">Register a new infrastructure location</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <Card.Header><h2 className="text-lg font-semibold">Basic Information</h2></Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                error={formErrors.name}
                required
                fullWidth
              />
              <Select
                label="Type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                options={[
                  { value: '', label: 'Select type' },
                  { value: 'TOWER', label: 'Tower' },
                  { value: 'NODE', label: 'Node' },
                  { value: 'DATACENTER', label: 'Datacenter' },
                  { value: 'POP', label: 'POP' },
                  { value: 'WAREHOUSE', label: 'Warehouse' },
                  { value: 'OFFICE', label: 'Office' }
                ]}
                error={formErrors.type}
                required
                fullWidth
              />
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header><h2 className="text-lg font-semibold">Address</h2></Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Municipality" name="municipality" value={formData.municipality} onChange={handleChange} fullWidth />
              <Input label="Neighborhood" name="neighborhood" value={formData.neighborhood} onChange={handleChange} fullWidth />
              <div className="md:col-span-2">
                <Input label="Address" name="address" value={formData.address} onChange={handleChange} fullWidth />
              </div>
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header><h2 className="text-lg font-semibold">Coordinates</h2></Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Latitude"
                name="latitude"
                type="number"
                value={formData.latitude}
                onChange={handleChange}
                error={formErrors.latitude}
                placeholder="-90 to 90"
                fullWidth
              />
              <Input
                label="Longitude"
                name="longitude"
                type="number"
                value={formData.longitude}
                onChange={handleChange}
                error={formErrors.longitude}
                placeholder="-180 to 180"
                fullWidth
              />
              <Input
                label="Altitude (m)"
                name="altitude"
                type="number"
                value={formData.altitude}
                onChange={handleChange}
                fullWidth
              />
            </div>
          </Card.Body>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Create Location
          </Button>
        </div>
      </form>
    </div>
  );
}
