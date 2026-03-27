/**
 * Create Network Device Page
 *
 * Form for creating new network devices in DRAFT or ACTIVE mode
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { CreateNetworkDeviceDTO } from '@/types/device.types';
import {
  Card,
  Button,
  Input,
  Select,
  LoadingSpinner
} from '@/components/ui';

type CreationMode = 'DRAFT' | 'ACTIVE';

export default function CreateDevicePage() {
  const router = useRouter();
  const [mode, setMode] = useState<CreationMode>('DRAFT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    ipAddress: '',
    macAddress: '',
    deviceId: '',
    name: '',
    deviceType: '',
    description: '',
    location: '',
    connectivityType: '',
    managementProtocol: 'SNMP',
    managementPort: '161',
    enabledRemoteAccess: false
  });

  // Form errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Handle input change
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Required fields (always)
    if (!formData.ipAddress) errors.ipAddress = 'IP address is required';
    if (!formData.macAddress) errors.macAddress = 'MAC address is required';
    if (!formData.deviceId) errors.deviceId = 'Device ID is required';

    // Required fields for ACTIVE mode
    if (mode === 'ACTIVE') {
      if (!formData.name) errors.name = 'Name is required for active devices';
      if (!formData.deviceType) errors.deviceType = 'Device type is required for active devices';
    }

    // Validation patterns
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (formData.ipAddress && !ipPattern.test(formData.ipAddress)) {
      errors.ipAddress = 'Invalid IP address format';
    }

    const macPattern = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (formData.macAddress && !macPattern.test(formData.macAddress)) {
      errors.macAddress = 'Invalid MAC address format (e.g., AA:BB:CC:DD:EE:FF)';
    }

    const port = parseInt(formData.managementPort);
    if (formData.managementPort && (port < 1 || port > 65535)) {
      errors.managementPort = 'Port must be between 1 and 65535';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const dto: CreateNetworkDeviceDTO = {
        ipAddress: formData.ipAddress,
        macAddress: formData.macAddress,
        deviceId: formData.deviceId,
        activateImmediately: mode === 'ACTIVE'
      };

      // Add optional fields if in ACTIVE mode or if provided
      if (formData.name) dto.name = formData.name;
      if (formData.deviceType) dto.deviceType = formData.deviceType;
      if (formData.description) dto.description = formData.description;
      if (formData.location) dto.location = formData.location;
      if (formData.connectivityType) dto.connectivityType = formData.connectivityType;
      if (formData.managementProtocol) dto.managementProtocol = formData.managementProtocol;
      if (formData.managementPort) dto.managementPort = parseInt(formData.managementPort);
      dto.enabledRemoteAccess = formData.enabledRemoteAccess;

      const result = await apiService.createDevice(dto);

      if (result.success && result.data) {
        router.push(`/devices/${result.data.id}`);
      } else {
        setError(result.error || 'Failed to create device');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
          >
            ← Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Create Network Device</h1>
        </div>
        <p className="text-gray-600">
          Add a new device to your network infrastructure
        </p>
      </div>

      {/* Mode Selection */}
      <Card className="mb-6">
        <Card.Header>
          <h2 className="text-lg font-semibold">Creation Mode</h2>
          <p className="text-sm text-gray-600 mt-1">
            Choose how to create the device
          </p>
        </Card.Header>
        <Card.Body>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setMode('DRAFT')}
              className={`
                p-4 border-2 rounded-lg text-left transition-all
                ${
                  mode === 'DRAFT'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <div className="font-semibold text-lg mb-1">Draft Mode</div>
              <p className="text-sm text-gray-600">
                Create a placeholder device with minimal information. Activate it later
                when ready.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setMode('ACTIVE')}
              className={`
                p-4 border-2 rounded-lg text-left transition-all
                ${
                  mode === 'ACTIVE'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <div className="font-semibold text-lg mb-1">Active Mode</div>
              <p className="text-sm text-gray-600">
                Create and activate the device immediately with complete information.
              </p>
            </button>
          </div>
        </Card.Body>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <Card.Header>
            <h2 className="text-lg font-semibold">Required Information</h2>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="IP Address"
                name="ipAddress"
                value={formData.ipAddress}
                onChange={handleChange}
                placeholder="192.168.1.100"
                error={formErrors.ipAddress}
                required
                fullWidth
              />
              <Input
                label="MAC Address"
                name="macAddress"
                value={formData.macAddress}
                onChange={handleChange}
                placeholder="AA:BB:CC:DD:EE:FF"
                error={formErrors.macAddress}
                required
                fullWidth
              />
              <Input
                label="Device ID"
                name="deviceId"
                value={formData.deviceId}
                onChange={handleChange}
                placeholder="device-001"
                error={formErrors.deviceId}
                helperText="Unique identifier for the device"
                required
                fullWidth
              />
            </div>
          </Card.Body>
        </Card>

        <Card className="mb-6">
          <Card.Header>
            <h2 className="text-lg font-semibold">
              Device Details
              {mode === 'ACTIVE' && (
                <span className="text-sm font-normal text-gray-600 ml-2">
                  (Required for active mode)
                </span>
              )}
            </h2>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Device Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Router-Core-01"
                error={formErrors.name}
                required={mode === 'ACTIVE'}
                fullWidth
              />
              <Select
                label="Device Type"
                name="deviceType"
                value={formData.deviceType}
                onChange={handleChange}
                options={[
                  { value: '', label: 'Select device type' },
                  { value: 'ROUTER', label: 'Router' },
                  { value: 'SWITCH', label: 'Switch' },
                  { value: 'ACCESS_POINT', label: 'Access Point' },
                  { value: 'FIREWALL', label: 'Firewall' },
                  { value: 'LOAD_BALANCER', label: 'Load Balancer' }
                ]}
                error={formErrors.deviceType}
                required={mode === 'ACTIVE'}
                fullWidth
              />
              <Input
                label="Location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Building A, Floor 3"
                fullWidth
              />
              <Select
                label="Connectivity Type"
                name="connectivityType"
                value={formData.connectivityType}
                onChange={handleChange}
                options={[
                  { value: '', label: 'Select connectivity' },
                  { value: 'ETHERNET', label: 'Ethernet' },
                  { value: 'FIBER_OPTIC', label: 'Fiber Optic' },
                  { value: 'WIRELESS', label: 'Wireless' },
                  { value: 'COPPER', label: 'Copper' }
                ]}
                fullWidth
              />
              <div className="md:col-span-2">
                <Input
                  label="Description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Main core router for building A"
                  fullWidth
                />
              </div>
            </div>
          </Card.Body>
        </Card>

        <Card className="mb-6">
          <Card.Header>
            <h2 className="text-lg font-semibold">Management Configuration</h2>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                label="Management Protocol"
                name="managementProtocol"
                value={formData.managementProtocol}
                onChange={handleChange}
                options={[
                  { value: 'SNMP', label: 'SNMP' },
                  { value: 'SSH', label: 'SSH' },
                  { value: 'TELNET', label: 'Telnet' },
                  { value: 'HTTP', label: 'HTTP' },
                  { value: 'HTTPS', label: 'HTTPS' },
                  { value: 'OTHER', label: 'Other' }
                ]}
                fullWidth
              />
              <Input
                label="Management Port"
                name="managementPort"
                type="number"
                value={formData.managementPort}
                onChange={handleChange}
                placeholder="161"
                error={formErrors.managementPort}
                fullWidth
              />
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="enabledRemoteAccess"
                    checked={formData.enabledRemoteAccess}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Enable Remote Access
                  </span>
                </label>
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant={mode === 'ACTIVE' ? 'success' : 'primary'}
            isLoading={isSubmitting}
          >
            {mode === 'DRAFT' ? 'Create as Draft' : 'Create and Activate'}
          </Button>
        </div>
      </form>
    </div>
  );
}
