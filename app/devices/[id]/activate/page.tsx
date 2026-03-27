/**
 * Activate Device Page
 *
 * Form for activating a DRAFT device to ACTIVE status
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiService } from '@/services/api.service';
import {
  NetworkDeviceResponseDTO,
  ActivateNetworkDeviceDTO
} from '@/types/device.types';
import {
  Card,
  Button,
  Input,
  Select,
  LoadingSpinner,
  Badge,
  getActivationStatusBadgeVariant
} from '@/components/ui';

export default function ActivateDevicePage() {
  const router = useRouter();
  const params = useParams();
  const deviceId = params.id as string;

  const [device, setDevice] = useState<NetworkDeviceResponseDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    deviceType: '',
    description: '',
    location: '',
    connectivityType: '',
    managementProtocol: 'SNMP',
    managementPort: '161',
    enabledRemoteAccess: false
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch device details
  useEffect(() => {
    const fetchDevice = async () => {
      setIsLoading(true);
      setError(null);

      const result = await apiService.getDeviceById(deviceId);

      if (result.success && result.data) {
        setDevice(result.data);

        // Check if already active
        if (result.data.activationStatus === 'ACTIVE') {
          setError('This device is already active');
          return;
        }

        // Pre-fill form with existing data
        setFormData({
          name: result.data.name || '',
          deviceType: result.data.deviceType || '',
          description: result.data.description || '',
          location: result.data.location || '',
          connectivityType: result.data.connectivityType || '',
          managementProtocol: result.data.managementProtocol,
          managementPort: result.data.managementPort.toString(),
          enabledRemoteAccess: result.data.enabledRemoteAccess
        });
      } else {
        setError(result.error || 'Failed to load device');
      }

      setIsLoading(false);
    };

    fetchDevice();
  }, [deviceId]);

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

    // Required fields
    if (!formData.name) errors.name = 'Name is required';
    if (!formData.deviceType) errors.deviceType = 'Device type is required';

    // Field length validation
    if (formData.name && formData.name.length > 255) {
      errors.name = 'Name must not exceed 255 characters';
    }

    if (formData.description && formData.description.length > 1000) {
      errors.description = 'Description must not exceed 1000 characters';
    }

    if (formData.location && formData.location.length > 500) {
      errors.location = 'Location must not exceed 500 characters';
    }

    // Port validation
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
      const activateDTO: ActivateNetworkDeviceDTO = {
        name: formData.name,
        deviceType: formData.deviceType,
        description: formData.description || undefined,
        location: formData.location || undefined,
        connectivityType: formData.connectivityType || undefined,
        managementProtocol: formData.managementProtocol,
        managementPort: parseInt(formData.managementPort),
        enabledRemoteAccess: formData.enabledRemoteAccess
      };

      const result = await apiService.activateDevice(deviceId, activateDTO);

      if (result.success && result.data) {
        router.push(`/devices/${deviceId}`);
      } else {
        setError(result.error || 'Failed to activate device');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" message="Loading device..." />
      </div>
    );
  }

  if (error && !device) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => router.back()}>
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!device) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            ← Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Activate Device</h1>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-gray-600">
            Complete device information to activate
          </p>
          <Badge variant={getActivationStatusBadgeVariant(device.activationStatus)}>
            {device.activationStatus}
          </Badge>
        </div>
      </div>

      {/* Info Card */}
      <Card className="mb-6">
        <Card.Body>
          <div className="flex items-start gap-3">
            <svg
              className="h-6 w-6 text-blue-500 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
              />
            </svg>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">
                Device Activation
              </h3>
              <p className="text-sm text-gray-600">
                Activating this device will make it operational and enable monitoring.
                All required fields must be completed. Immutable fields (IP, MAC, Device ID)
                cannot be changed after activation.
              </p>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Current Device Info */}
      <Card className="mb-6">
        <Card.Header>
          <h2 className="text-lg font-semibold">Current Device Information</h2>
          <p className="text-sm text-gray-600 mt-1">These fields cannot be changed</p>
        </Card.Header>
        <Card.Body>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Device ID</dt>
              <dd className="mt-1 text-sm text-gray-900">{device.deviceId}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">IP Address</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">
                {device.ipAddress}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">MAC Address</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">
                {device.macAddress}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1 text-sm text-gray-900">{device.status}</dd>
            </div>
          </dl>
        </Card.Body>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Activation Form */}
      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <Card.Header>
            <h2 className="text-lg font-semibold">
              Required Information
              <span className="text-red-500 ml-1">*</span>
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
                required
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
                required
                fullWidth
              />
              <Input
                label="Location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Building A, Floor 3"
                error={formErrors.location}
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
                  error={formErrors.description}
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
          <Button type="submit" variant="success" isLoading={isSubmitting}>
            Activate Device
          </Button>
        </div>
      </form>
    </div>
  );
}
