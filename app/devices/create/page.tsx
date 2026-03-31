'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api.service';
import {
  CreateDeviceDTO,
  DeviceModelResponseDTO,
  LocationResponseDTO,
  DeviceStatus,
  DeviceCategory,
  DeviceOwnerType
} from '@/types/device.types';
import { Card, Button, Input, Select, LoadingSpinner } from '@/components/ui';

export default function CreateDevicePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [deviceModels, setDeviceModels] = useState<DeviceModelResponseDTO[]>([]);
  const [locations, setLocations] = useState<LocationResponseDTO[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [formData, setFormData] = useState({
    deviceModelId: '',
    name: '',
    ownerType: '' as DeviceOwnerType | '',
    status: '' as DeviceStatus | '',
    category: '' as DeviceCategory | '',
    monitoringEnabled: false,
    ipAddress: '',
    macAddress: '',
    serialNumber: '',
    locationId: '',
    installedDate: '',
    description: ''
  });

  useEffect(() => {
    const loadOptions = async () => {
      const [modelsRes, locationsRes] = await Promise.all([
        apiService.listDeviceModels({ limit: 100 }),
        apiService.listLocations({ limit: 100 })
      ]);
      if (modelsRes.success && modelsRes.data) setDeviceModels(modelsRes.data.deviceModels);
      if (locationsRes.success && locationsRes.data) setLocations(locationsRes.data.locations);
      setLoadingOptions(false);
    };
    loadOptions();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (formErrors[name]) {
      setFormErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.deviceModelId) errors.deviceModelId = 'Device model is required';
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.ownerType) errors.ownerType = 'Owner type is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setError(null);

    const dto: CreateDeviceDTO = {
      deviceModelId: formData.deviceModelId,
      name: formData.name.trim(),
      ownerType: formData.ownerType as DeviceOwnerType
    };

    if (formData.status) dto.status = formData.status as DeviceStatus;
    if (formData.category) dto.category = formData.category as DeviceCategory;
    dto.monitoringEnabled = formData.monitoringEnabled;
    if (formData.ipAddress.trim()) dto.ipAddress = formData.ipAddress.trim();
    if (formData.macAddress.trim()) dto.macAddress = formData.macAddress.trim();
    if (formData.serialNumber.trim()) dto.serialNumber = formData.serialNumber.trim();
    if (formData.locationId) dto.locationId = formData.locationId;
    if (formData.installedDate) dto.installedDate = new Date(formData.installedDate).toISOString();
    if (formData.description.trim()) dto.description = formData.description.trim();

    const result = await apiService.createDevice(dto);

    if (result.success && result.data) {
      router.push(`/devices/${result.data.id}`);
    } else {
      setError(result.error || 'Failed to create device');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            ← Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Add Device</h1>
        </div>
        <p className="text-gray-600">Register a new device in the network</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {loadingOptions ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner message="Loading options..." />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Required */}
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold">Required Information</h2>
            </Card.Header>
            <Card.Body>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Select
                    label="Device Model"
                    name="deviceModelId"
                    value={formData.deviceModelId}
                    onChange={handleChange}
                    options={[
                      { value: '', label: 'Select a device model' },
                      ...deviceModels.map((m) => ({
                        value: m.id,
                        label: `${m.manufacturer.replace(/_/g, ' ')} — ${m.model} (${m.deviceType})`
                      }))
                    ]}
                    error={formErrors.deviceModelId}
                    required
                    fullWidth
                  />
                </div>
                <Input
                  label="Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Router-Core-01"
                  error={formErrors.name}
                  required
                  fullWidth
                />
                <Select
                  label="Owner Type"
                  name="ownerType"
                  value={formData.ownerType}
                  onChange={handleChange}
                  options={[
                    { value: '', label: 'Select owner type' },
                    { value: 'COMPANY', label: 'Company' },
                    { value: 'CLIENT', label: 'Client' }
                  ]}
                  error={formErrors.ownerType}
                  required
                  fullWidth
                />
              </div>
            </Card.Body>
          </Card>

          {/* Classification */}
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold">Classification</h2>
            </Card.Header>
            <Card.Body>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  options={[
                    { value: '', label: 'Default (Inventory)' },
                    { value: 'INVENTORY', label: 'Inventory' },
                    { value: 'ACTIVE', label: 'Active' },
                    { value: 'MAINTENANCE', label: 'Maintenance' },
                    { value: 'DAMAGED', label: 'Damaged' },
                    { value: 'DECOMMISSIONED', label: 'Decommissioned' }
                  ]}
                  fullWidth
                />
                <Select
                  label="Category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  options={[
                    { value: '', label: 'None' },
                    { value: 'CORE', label: 'Core' },
                    { value: 'DISTRIBUTION', label: 'Distribution' },
                    { value: 'POE', label: 'PoE' },
                    { value: 'ACCESS_POINT', label: 'Access Point' },
                    { value: 'CLIENT_CPE', label: 'Client CPE' }
                  ]}
                  fullWidth
                />
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="monitoringEnabled"
                    name="monitoringEnabled"
                    checked={formData.monitoringEnabled}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="monitoringEnabled" className="text-sm font-medium text-gray-700">
                    Enable monitoring
                  </label>
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* Network */}
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold">Network Details</h2>
            </Card.Header>
            <Card.Body>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="IP Address"
                  name="ipAddress"
                  value={formData.ipAddress}
                  onChange={handleChange}
                  placeholder="192.168.1.100"
                  fullWidth
                />
                <Input
                  label="MAC Address"
                  name="macAddress"
                  value={formData.macAddress}
                  onChange={handleChange}
                  placeholder="AA:BB:CC:DD:EE:FF"
                  fullWidth
                />
                <Input
                  label="Serial Number"
                  name="serialNumber"
                  value={formData.serialNumber}
                  onChange={handleChange}
                  fullWidth
                />
              </div>
            </Card.Body>
          </Card>

          {/* Location & Metadata */}
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold">Location & Metadata</h2>
            </Card.Header>
            <Card.Body>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Location"
                  name="locationId"
                  value={formData.locationId}
                  onChange={handleChange}
                  options={[
                    { value: '', label: 'No location' },
                    ...locations.map((l) => ({ value: l.id, label: l.name }))
                  ]}
                  fullWidth
                />
                <Input
                  label="Installed Date"
                  name="installedDate"
                  type="date"
                  value={formData.installedDate}
                  onChange={handleChange}
                  fullWidth
                />
                <div className="md:col-span-2">
                  <Input
                    label="Description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Optional description"
                    fullWidth
                  />
                </div>
              </div>
            </Card.Body>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Create Device
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
