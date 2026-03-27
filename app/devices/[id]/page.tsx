/**
 * Device Detail Page
 *
 * View and edit network device details with lifecycle operations
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { useDeviceUpdates } from '@/hooks/useDeviceUpdates';
import {
  NetworkDeviceResponseDTO,
  UpdateNetworkDeviceDTO
} from '@/types/device.types';
import {
  Card,
  Button,
  Input,
  Select,
  LoadingSpinner,
  Badge,
  Modal,
  ConfirmModal,
  getStatusBadgeVariant,
  getActivationStatusBadgeVariant
} from '@/components/ui';

export default function DeviceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const deviceId = params.id as string;

  const [device, setDevice] = useState<NetworkDeviceResponseDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSoftDeleteModal, setShowSoftDeleteModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    managementProtocol: '',
    managementPort: '',
    enabledRemoteAccess: false
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch device details
  const fetchDevice = async () => {
    setIsLoading(true);
    setError(null);

    const result = await apiService.getDeviceById(deviceId);

    if (result.success && result.data) {
      setDevice(result.data);
      setFormData({
        name: result.data.name || '',
        description: result.data.description || '',
        location: result.data.location || '',
        managementProtocol: result.data.managementProtocol,
        managementPort: result.data.managementPort.toString(),
        enabledRemoteAccess: result.data.enabledRemoteAccess
      });
    } else {
      setError(result.error || 'Failed to load device');
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchDevice();
  }, [deviceId]);

  // Real-time updates
  useDeviceUpdates({
    onStatusChanged: (payload) => {
      if (payload.deviceId === deviceId) {
        setDevice((prev) => (prev ? { ...prev, status: payload.newStatus } : null));
      }
    },
    onDeviceUpdated: (payload) => {
      if (payload.deviceId === deviceId) {
        fetchDevice();
      }
    },
    onDeviceDeleted: (payload) => {
      if (payload.deviceId === deviceId) {
        router.push('/devices');
      }
    },
    onDeviceActivated: (payload) => {
      if (payload.deviceId === deviceId) {
        fetchDevice();
      }
    },
    onDeviceRestored: () => {
      fetchDevice();
    }
  });

  // Handle form change
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

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

    const port = parseInt(formData.managementPort);
    if (formData.managementPort && (port < 1 || port > 65535)) {
      errors.managementPort = 'Port must be between 1 and 65535';
    }

    if (formData.name && formData.name.length > 255) {
      errors.name = 'Name must not exceed 255 characters';
    }

    if (formData.description && formData.description.length > 1000) {
      errors.description = 'Description must not exceed 1000 characters';
    }

    if (formData.location && formData.location.length > 500) {
      errors.location = 'Location must not exceed 500 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    setError(null);

    const updateDTO: UpdateNetworkDeviceDTO = {
      name: formData.name || undefined,
      description: formData.description || undefined,
      location: formData.location || undefined,
      managementProtocol: formData.managementProtocol,
      managementPort: parseInt(formData.managementPort),
      enabledRemoteAccess: formData.enabledRemoteAccess
    };

    const result = await apiService.updateDevice(deviceId, updateDTO);

    if (result.success && result.data) {
      setDevice(result.data);
      setIsEditing(false);
    } else {
      setError(result.error || 'Failed to update device');
    }

    setIsSaving(false);
  };

  // Handle hard delete
  const handleDelete = async () => {
    setIsDeleting(true);

    const result = await apiService.deleteDevice(deviceId);

    if (result.success) {
      router.push('/devices');
    } else {
      setError(result.error || 'Failed to delete device');
      setIsDeleting(false);
    }

    setShowDeleteModal(false);
  };

  // Handle soft delete
  const handleSoftDelete = async () => {
    setIsDeleting(true);

    const result = await apiService.softDeleteDevice(deviceId, {
      reason: 'Deleted via UI'
    });

    if (result.success) {
      fetchDevice();
    } else {
      setError(result.error || 'Failed to soft delete device');
    }

    setIsDeleting(false);
    setShowSoftDeleteModal(false);
  };

  // Handle restore
  const handleRestore = async () => {
    setIsDeleting(true);

    const result = await apiService.restoreDevice(deviceId);

    if (result.success) {
      fetchDevice();
    } else {
      setError(result.error || 'Failed to restore device');
    }

    setIsDeleting(false);
    setShowRestoreModal(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" message="Loading device details..." />
      </div>
    );
  }

  if (error && !device) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => router.back()}>
              Go Back
            </Button>
            <Button onClick={fetchDevice}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!device) return null;

  const isSoftDeleted = device.deletedAt !== null;
  const isDraft = device.activationStatus === 'DRAFT';

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              ← Back
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">
              {device.name || 'Unnamed Device'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getStatusBadgeVariant(device.status)}>
              {device.status}
            </Badge>
            <Badge variant={getActivationStatusBadgeVariant(device.activationStatus)}>
              {device.activationStatus}
            </Badge>
            {isSoftDeleted && <Badge variant="danger">SOFT DELETED</Badge>}
          </div>
        </div>

        <div className="flex gap-2">
          {!isSoftDeleted && (
            <>
              {!isEditing ? (
                <>
                  {isDraft && (
                    <Button
                      variant="success"
                      onClick={() => router.push(`/devices/${deviceId}/activate`)}
                    >
                      Activate
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setShowSoftDeleteModal(true)}
                  >
                    Delete
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setFormData({
                        name: device.name || '',
                        description: device.description || '',
                        location: device.location || '',
                        managementProtocol: device.managementProtocol,
                        managementPort: device.managementPort.toString(),
                        enabledRemoteAccess: device.enabledRemoteAccess
                      });
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSave} isLoading={isSaving}>
                    Save Changes
                  </Button>
                </>
              )}
            </>
          )}

          {isSoftDeleted && (
            <Button variant="success" onClick={() => setShowRestoreModal(true)}>
              Restore Device
            </Button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Soft Delete Warning */}
      {isSoftDeleted && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 font-medium">
            This device has been soft-deleted and will be permanently removed after the
            7-day grace period.
          </p>
          <p className="text-sm text-yellow-700 mt-1">
            Deleted: {new Date(device.deletedAt!).toLocaleString()}
            {device.deletedBy && ` by ${device.deletedBy}`}
          </p>
          {device.deletionReason && (
            <p className="text-sm text-yellow-700 mt-1">
              Reason: {device.deletionReason}
            </p>
          )}
        </div>
      )}

      {/* Device Information */}
      <Card className="mb-6">
        <Card.Header>
          <h2 className="text-lg font-semibold">Device Information</h2>
        </Card.Header>
        <Card.Body>
          {isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Device Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                error={formErrors.name}
                fullWidth
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Device Type
                </label>
                <p className="text-sm text-gray-500 italic">
                  {device.deviceType} (Immutable)
                </p>
              </div>
              <Input
                label="Location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                error={formErrors.location}
                fullWidth
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Connectivity Type
                </label>
                <p className="text-sm text-gray-500 italic">
                  {device.connectivityType} (Immutable)
                </p>
              </div>
              <div className="md:col-span-2">
                <Input
                  label="Description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  error={formErrors.description}
                  fullWidth
                />
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Device ID</dt>
                <dd className="mt-1 text-sm text-gray-900">{device.deviceId}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Device Type</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {device.deviceType.replace(/_/g, ' ')}
                </dd>
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
                <dt className="text-sm font-medium text-gray-500">Location</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {device.location || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Connectivity Type
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {device.connectivityType.replace(/_/g, ' ')}
                </dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Description</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {device.description || '—'}
                </dd>
              </div>
            </dl>
          )}
        </Card.Body>
      </Card>

      {/* Management Configuration */}
      <Card className="mb-6">
        <Card.Header>
          <h2 className="text-lg font-semibold">Management Configuration</h2>
        </Card.Header>
        <Card.Body>
          {isEditing ? (
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
          ) : (
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Protocol</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {device.managementProtocol}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Port</dt>
                <dd className="mt-1 text-sm text-gray-900">{device.managementPort}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Remote Access</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {device.enabledRemoteAccess ? 'Enabled' : 'Disabled'}
                </dd>
              </div>
            </dl>
          )}
        </Card.Body>
      </Card>

      {/* Polling Configuration */}
      <Card className="mb-6">
        <Card.Header>
          <h2 className="text-lg font-semibold">Polling Configuration</h2>
        </Card.Header>
        <Card.Body>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Interval</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {device.pollingConfiguration.intervalSeconds} seconds
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Retry Attempts</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {device.pollingConfiguration.retryAttempts}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <Badge
                  variant={device.pollingConfiguration.enabled ? 'success' : 'neutral'}
                >
                  {device.pollingConfiguration.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </dd>
            </div>
          </dl>
        </Card.Body>
      </Card>

      {/* Metadata */}
      <Card>
        <Card.Header>
          <h2 className="text-lg font-semibold">Metadata</h2>
        </Card.Header>
        <Card.Body>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-gray-900">
                {new Date(device.createdAt).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Last Updated</dt>
              <dd className="mt-1 text-gray-900">
                {new Date(device.updatedAt).toLocaleString()}
              </dd>
            </div>
            {device.activatedAt && (
              <>
                <div>
                  <dt className="font-medium text-gray-500">Activated At</dt>
                  <dd className="mt-1 text-gray-900">
                    {new Date(device.activatedAt).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Activated By</dt>
                  <dd className="mt-1 text-gray-900">{device.activatedBy || '—'}</dd>
                </div>
              </>
            )}
          </dl>
        </Card.Body>
      </Card>

      {/* Modals */}
      <ConfirmModal
        isOpen={showSoftDeleteModal}
        onClose={() => setShowSoftDeleteModal(false)}
        onConfirm={handleSoftDelete}
        title="Soft Delete Device"
        message="This device will be marked for deletion with a 7-day grace period. You can restore it during this time. Are you sure?"
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Permanently Delete Device"
        message="This action cannot be undone. The device will be permanently removed from the system. Are you sure?"
        confirmText="Delete Permanently"
        variant="danger"
        isLoading={isDeleting}
      />

      <ConfirmModal
        isOpen={showRestoreModal}
        onClose={() => setShowRestoreModal(false)}
        onConfirm={handleRestore}
        title="Restore Device"
        message="This will restore the device and cancel the deletion. Are you sure?"
        confirmText="Restore"
        variant="success"
        isLoading={isDeleting}
      />
    </div>
  );
}
