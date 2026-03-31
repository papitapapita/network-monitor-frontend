'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { LocationResponseDTO, UpdateLocationDTO, LocationType } from '@/types/device.types';
import { Card, Button, Input, Select, LoadingSpinner, Badge } from '@/components/ui';

export default function LocationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const locationId = params.id as string;

  const [location, setLocation] = useState<LocationResponseDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  const fetchLocation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await apiService.getLocation(locationId);
    if (result.success && result.data) {
      const l = result.data;
      setLocation(l);
      setFormData({
        name: l.name,
        type: l.type,
        municipality: l.municipality ?? '',
        neighborhood: l.neighborhood ?? '',
        address: l.address ?? '',
        latitude: l.latitude !== null ? String(l.latitude) : '',
        longitude: l.longitude !== null ? String(l.longitude) : '',
        altitude: l.altitude !== null ? String(l.altitude) : ''
      });
    } else {
      setError(result.error || 'Failed to load location');
    }
    setIsLoading(false);
  }, [locationId]);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    const lat = parseFloat(formData.latitude);
    const lon = parseFloat(formData.longitude);
    if ((formData.latitude && !formData.longitude) || (!formData.latitude && formData.longitude)) {
      errors.latitude = 'Latitude and longitude must both be provided';
    }
    if (formData.latitude && (lat < -90 || lat > 90)) errors.latitude = 'Latitude must be between -90 and 90';
    if (formData.longitude && (lon < -180 || lon > 180)) errors.longitude = 'Longitude must be between -180 and 180';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    setError(null);

    const dto: UpdateLocationDTO = {
      name: formData.name.trim(),
      type: formData.type as LocationType || undefined,
      municipality: formData.municipality.trim() || null,
      neighborhood: formData.neighborhood.trim() || null,
      address: formData.address.trim() || null,
      latitude: formData.latitude ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      altitude: formData.altitude ? parseFloat(formData.altitude) : null
    };

    const result = await apiService.updateLocation(locationId, dto);
    if (result.success && result.data) {
      setLocation(result.data);
      setIsEditing(false);
    } else {
      setError(result.error || 'Failed to update location');
    }
    setIsSaving(false);
  };

  const cancelEdit = () => {
    if (!location) return;
    setIsEditing(false);
    setFormErrors({});
    setFormData({
      name: location.name,
      type: location.type,
      municipality: location.municipality ?? '',
      neighborhood: location.neighborhood ?? '',
      address: location.address ?? '',
      latitude: location.latitude !== null ? String(location.latitude) : '',
      longitude: location.longitude !== null ? String(location.longitude) : '',
      altitude: location.altitude !== null ? String(location.altitude) : ''
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" message="Loading location..." />
      </div>
    );
  }

  if (error && !location) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
            <Button onClick={fetchLocation}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!location) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              ← Back
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">{location.name}</h1>
          </div>
          <Badge variant="info">{location.type}</Badge>
        </div>

        <div className="flex gap-2">
          {!isEditing ? (
            <Button variant="outline" onClick={() => setIsEditing(true)}>Edit</Button>
          ) : (
            <>
              <Button variant="outline" onClick={cancelEdit} disabled={isSaving}>Cancel</Button>
              <Button onClick={handleSave} isLoading={isSaving}>Save Changes</Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {isEditing ? (
        <div className="space-y-6">
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
                    { value: 'TOWER', label: 'Tower' },
                    { value: 'NODE', label: 'Node' },
                    { value: 'DATACENTER', label: 'Datacenter' },
                    { value: 'POP', label: 'POP' },
                    { value: 'WAREHOUSE', label: 'Warehouse' },
                    { value: 'OFFICE', label: 'Office' }
                  ]}
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
                  fullWidth
                />
                <Input
                  label="Longitude"
                  name="longitude"
                  type="number"
                  value={formData.longitude}
                  onChange={handleChange}
                  error={formErrors.longitude}
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
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <Card.Header><h2 className="text-lg font-semibold">Location Details</h2></Card.Header>
            <Card.Body>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="font-medium text-gray-500">Name</dt>
                  <dd className="mt-1 text-gray-900">{location.name}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Type</dt>
                  <dd className="mt-1"><Badge variant="info">{location.type}</Badge></dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Municipality</dt>
                  <dd className="mt-1 text-gray-900">{location.municipality || '—'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Neighborhood</dt>
                  <dd className="mt-1 text-gray-900">{location.neighborhood || '—'}</dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="font-medium text-gray-500">Address</dt>
                  <dd className="mt-1 text-gray-900">{location.address || '—'}</dd>
                </div>
              </dl>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header><h2 className="text-lg font-semibold">Coordinates</h2></Card.Header>
            <Card.Body>
              <dl className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="font-medium text-gray-500">Latitude</dt>
                  <dd className="mt-1 font-mono text-gray-900">
                    {location.latitude !== null ? location.latitude : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Longitude</dt>
                  <dd className="mt-1 font-mono text-gray-900">
                    {location.longitude !== null ? location.longitude : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Altitude (m)</dt>
                  <dd className="mt-1 font-mono text-gray-900">
                    {location.altitude !== null ? location.altitude : '—'}
                  </dd>
                </div>
              </dl>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header><h2 className="text-lg font-semibold">Metadata</h2></Card.Header>
            <Card.Body>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-gray-900">{new Date(location.createdAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Last Updated</dt>
                  <dd className="mt-1 text-gray-900">{new Date(location.updatedAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">ID</dt>
                  <dd className="mt-1 text-gray-900 font-mono text-xs">{location.id}</dd>
                </div>
              </dl>
            </Card.Body>
          </Card>
        </div>
      )}
    </div>
  );
}
