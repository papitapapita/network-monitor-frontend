'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiService } from '@/services/api.service';
import {
  DeviceResponseDTO,
  UpdateDeviceDTO,
  LocationResponseDTO,
  PollingStatusDTO,
  PollingHistoryResponse,
  ManualPollResultDTO,
  DeviceStatus,
  DeviceCategory,
  DeviceOwnerType
} from '@/types/device.types';
import {
  Card,
  Button,
  Input,
  Select,
  LoadingSpinner,
  Badge,
  getDeviceStatusBadgeVariant,
  getPollingStatusBadgeVariant
} from '@/components/ui';
import { LocationCreateModal } from '@/components/LocationCreateModal';

type Tab = 'details' | 'polling';

export default function DeviceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const deviceId = params.id as string;

  const [activeTab, setActiveTab] = useState<Tab>('details');

  // ── Details ──────────────────────────────────────────────
  const [device, setDevice] = useState<DeviceResponseDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationResponseDTO[]>([]);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    status: '' as DeviceStatus | '',
    category: '' as DeviceCategory | '',
    ownerType: '' as DeviceOwnerType | '',
    ipAddress: '',
    macAddress: '',
    serialNumber: '',
    locationId: '',
    installedDate: '',
    description: '',
    monitoringEnabled: false
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ── Polling – Status ──────────────────────────────────────
  const [pollingStatus, setPollingStatus] = useState<PollingStatusDTO | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollResult, setPollResult] = useState<ManualPollResultDTO | null>(null);

  // ── Polling – Config ──────────────────────────────────────
  const [configForm, setConfigForm] = useState({
    enabled: false,
    intervalSeconds: '',
    failuresBeforeDown: ''
  });
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState(false);

  // ── Polling – History ─────────────────────────────────────
  const [historyQuery, setHistoryQuery] = useState({
    fromDate: '',
    toDate: '',
    status: '',
    limit: '50',
    offset: 0
  });
  const [pollingHistory, setPollingHistory] = useState<PollingHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // ── Fetch device ──────────────────────────────────────────
  const fetchDevice = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await apiService.getDevice(deviceId);
    if (result.success && result.data) {
      const d = result.data;
      setDevice(d);
      setFormData({
        name: d.name,
        status: d.status,
        category: d.category ?? '',
        ownerType: d.ownerType,
        ipAddress: d.ipAddress ?? '',
        macAddress: d.macAddress ?? '',
        serialNumber: d.serialNumber ?? '',
        locationId: d.locationId ?? '',
        installedDate: d.installedDate ? d.installedDate.slice(0, 10) : '',
        description: d.description ?? '',
        monitoringEnabled: d.monitoringEnabled
      });
    } else {
      setError(result.error || 'Failed to load device');
    }
    setIsLoading(false);
  }, [deviceId]);

  useEffect(() => {
    fetchDevice();
    apiService.listLocations({ limit: 100 }).then((r) => {
      if (r.success && r.data) setLocations(r.data.locations);
    });
  }, [fetchDevice]);

  // ── Fetch polling status ──────────────────────────────────
  const fetchPollingStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    const result = await apiService.getPollingStatus(deviceId);
    if (result.success && result.data) {
      const s = result.data;
      setPollingStatus(s);
      setConfigForm({
        enabled: s.pollingEnabled,
        intervalSeconds: String(s.intervalSeconds),
        failuresBeforeDown: String(s.failuresBeforeDown)
      });
    } else {
      setStatusError(result.error || 'Failed to load polling status');
    }
    setStatusLoading(false);
  }, [deviceId]);

  useEffect(() => {
    if (activeTab === 'polling' && !pollingStatus) {
      fetchPollingStatus();
    }
  }, [activeTab, pollingStatus, fetchPollingStatus]);

  // ── Edit form handlers ────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (formErrors[name]) {
      setFormErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    setError(null);

    const dto: UpdateDeviceDTO = {
      name: formData.name.trim(),
      status: formData.status as DeviceStatus || undefined,
      category: (formData.category as DeviceCategory) || null,
      ownerType: formData.ownerType as DeviceOwnerType || undefined,
      ipAddress: formData.ipAddress.trim() || null,
      macAddress: formData.macAddress.trim() || null,
      serialNumber: formData.serialNumber.trim() || null,
      locationId: formData.locationId || null,
      installedDate: formData.installedDate
        ? new Date(formData.installedDate).toISOString()
        : null,
      description: formData.description.trim() || null,
      monitoringEnabled: formData.monitoringEnabled
    };

    const result = await apiService.updateDevice(deviceId, dto);
    if (result.success && result.data) {
      setDevice(result.data);
      setIsEditing(false);
    } else {
      setError(result.error || 'Failed to update device');
    }
    setIsSaving(false);
  };

  const cancelEdit = () => {
    if (!device) return;
    setIsEditing(false);
    setFormErrors({});
    setFormData({
      name: device.name,
      status: device.status,
      category: device.category ?? '',
      ownerType: device.ownerType,
      ipAddress: device.ipAddress ?? '',
      macAddress: device.macAddress ?? '',
      serialNumber: device.serialNumber ?? '',
      locationId: device.locationId ?? '',
      installedDate: device.installedDate ? device.installedDate.slice(0, 10) : '',
      description: device.description ?? '',
      monitoringEnabled: device.monitoringEnabled
    });
  };

  // ── Poll now ──────────────────────────────────────────────
  const handlePollNow = async () => {
    setIsPolling(true);
    setPollResult(null);
    const result = await apiService.triggerPoll(deviceId);
    if (result.success && result.data) {
      setPollResult(result.data);
      fetchPollingStatus();
    } else {
      setStatusError(result.error || 'Poll failed');
    }
    setIsPolling(false);
  };

  // ── Save polling config ───────────────────────────────────
  const handleSaveConfig = async () => {
    setConfigSaving(true);
    setConfigError(null);
    setConfigSuccess(false);

    const data: { intervalSeconds?: number; failuresBeforeDown?: number; enabled?: boolean } = {};
    if (configForm.intervalSeconds) data.intervalSeconds = parseInt(configForm.intervalSeconds);
    if (configForm.failuresBeforeDown) data.failuresBeforeDown = parseInt(configForm.failuresBeforeDown);
    data.enabled = configForm.enabled;

    const result = await apiService.updatePollingConfig(deviceId, data);
    if (result.success) {
      setConfigSuccess(true);
      fetchPollingStatus();
    } else {
      setConfigError(result.error || 'Failed to save config');
    }
    setConfigSaving(false);
  };

  // ── Fetch history ─────────────────────────────────────────
  const fetchHistory = async (offset = 0) => {
    setHistoryLoading(true);
    setHistoryError(null);
    const result = await apiService.getPollingHistory(deviceId, {
      fromDate: historyQuery.fromDate || undefined,
      toDate: historyQuery.toDate || undefined,
      status: historyQuery.status || undefined,
      limit: parseInt(historyQuery.limit),
      offset
    });
    if (result.success && result.data) {
      setPollingHistory(result.data);
      setHistoryQuery((prev) => ({ ...prev, offset }));
    } else {
      setHistoryError(result.error || 'Failed to load history');
    }
    setHistoryLoading(false);
  };

  // ── Loading / Error ───────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" message="Loading device..." />
      </div>
    );
  }

  if (error && !device) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
            <Button onClick={fetchDevice}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!device) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Page header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              ← Back
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">{device.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getDeviceStatusBadgeVariant(device.status)}>
              {device.status}
            </Badge>
            {device.category && (
              <Badge variant="info">{device.category.replace(/_/g, ' ')}</Badge>
            )}
            <Badge variant={device.monitoringEnabled ? 'success' : 'neutral'}>
              Monitoring {device.monitoringEnabled ? 'ON' : 'OFF'}
            </Badge>
          </div>
        </div>

        {activeTab === 'details' && (
          <div className="flex gap-2">
            {!isEditing ? (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={cancelEdit} disabled={isSaving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} isLoading={isSaving}>
                  Save Changes
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Tab bar */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {(['details', 'polling'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Details Tab ─────────────────────────────────── */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          {isEditing ? (
            <Card>
              <Card.Header><h2 className="text-lg font-semibold">Edit Device</h2></Card.Header>
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
                    label="Owner Type"
                    name="ownerType"
                    value={formData.ownerType}
                    onChange={handleChange}
                    options={[
                      { value: 'COMPANY', label: 'Company' },
                      { value: 'CLIENT', label: 'Client' }
                    ]}
                    fullWidth
                  />
                  <Select
                    label="Status"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    options={[
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
                  <Input label="IP Address" name="ipAddress" value={formData.ipAddress} onChange={handleChange} fullWidth />
                  <Input label="MAC Address" name="macAddress" value={formData.macAddress} onChange={handleChange} fullWidth />
                  <Input label="Serial Number" name="serialNumber" value={formData.serialNumber} onChange={handleChange} fullWidth />
                  <div className="w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <div className="flex items-center gap-2">
                      <Select
                        name="locationId"
                        value={formData.locationId}
                        onChange={handleChange}
                        options={[
                          { value: '', label: 'No location' },
                          ...locations.map((l) => ({ value: l.id, label: l.name }))
                        ]}
                        fullWidth
                      />
                      <button
                        type="button"
                        onClick={() => setShowLocationModal(true)}
                        className="flex-shrink-0 w-9 h-9 rounded-md border border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700 flex items-center justify-center text-xl font-medium"
                        title="Create new location"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <Input
                    label="Installed Date"
                    name="installedDate"
                    type="date"
                    value={formData.installedDate}
                    onChange={handleChange}
                    fullWidth
                  />
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="edit-monitoring"
                      name="monitoringEnabled"
                      checked={formData.monitoringEnabled}
                      onChange={handleChange}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="edit-monitoring" className="text-sm font-medium text-gray-700">
                      Enable monitoring
                    </label>
                  </div>
                  <div className="md:col-span-2">
                    <Input
                      label="Description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      fullWidth
                    />
                  </div>
                </div>
              </Card.Body>
            </Card>
          ) : (
            <>
              <Card>
                <Card.Header><h2 className="text-lg font-semibold">Device Information</h2></Card.Header>
                <Card.Body>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="font-medium text-gray-500">Name</dt>
                      <dd className="mt-1 text-gray-900">{device.name}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Status</dt>
                      <dd className="mt-1">
                        <Badge variant={getDeviceStatusBadgeVariant(device.status)}>{device.status}</Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Category</dt>
                      <dd className="mt-1 text-gray-900">
                        {device.category ? device.category.replace(/_/g, ' ') : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Owner Type</dt>
                      <dd className="mt-1 text-gray-900">{device.ownerType}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">IP Address</dt>
                      <dd className="mt-1 font-mono text-gray-900">{device.ipAddress || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">MAC Address</dt>
                      <dd className="mt-1 font-mono text-gray-900">{device.macAddress || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Serial Number</dt>
                      <dd className="mt-1 text-gray-900">{device.serialNumber || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Monitoring</dt>
                      <dd className="mt-1">
                        <Badge variant={device.monitoringEnabled ? 'success' : 'neutral'}>
                          {device.monitoringEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Installed Date</dt>
                      <dd className="mt-1 text-gray-900">
                        {device.installedDate
                          ? new Date(device.installedDate).toLocaleDateString()
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Location ID</dt>
                      <dd className="mt-1 text-gray-900 font-mono text-xs">{device.locationId || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Device Model ID</dt>
                      <dd className="mt-1 text-gray-900 font-mono text-xs">{device.deviceModelId}</dd>
                    </div>
                    <div className="md:col-span-2">
                      <dt className="font-medium text-gray-500">Description</dt>
                      <dd className="mt-1 text-gray-900">{device.description || '—'}</dd>
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
                      <dd className="mt-1 text-gray-900">{new Date(device.createdAt).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Last Updated</dt>
                      <dd className="mt-1 text-gray-900">{new Date(device.updatedAt).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">ID</dt>
                      <dd className="mt-1 text-gray-900 font-mono text-xs">{device.id}</dd>
                    </div>
                  </dl>
                </Card.Body>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── Polling Tab ──────────────────────────────────── */}
      {activeTab === 'polling' && (
        <div className="space-y-6">

          {/* Status */}
          <Card>
            <Card.Header>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Polling Status</h2>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={fetchPollingStatus} disabled={statusLoading}>
                    Refresh
                  </Button>
                  <Button size="sm" onClick={handlePollNow} isLoading={isPolling}>
                    Poll Now
                  </Button>
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              {statusLoading ? (
                <div className="flex justify-center py-4">
                  <LoadingSpinner message="Loading status..." />
                </div>
              ) : statusError ? (
                <p className="text-red-600 text-sm">{statusError}</p>
              ) : pollingStatus ? (
                <>
                  <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <dt className="font-medium text-gray-500">Current Status</dt>
                      <dd className="mt-1">
                        <Badge variant={getPollingStatusBadgeVariant(pollingStatus.currentStatus)}>
                          {pollingStatus.currentStatus}
                        </Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Polling Enabled</dt>
                      <dd className="mt-1">
                        <Badge variant={pollingStatus.pollingEnabled ? 'success' : 'neutral'}>
                          {pollingStatus.pollingEnabled ? 'Yes' : 'No'}
                        </Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Consecutive Failures</dt>
                      <dd className="mt-1 text-gray-900">{pollingStatus.consecutiveFailures}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Interval</dt>
                      <dd className="mt-1 text-gray-900">{pollingStatus.intervalSeconds}s</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Failures Before Down</dt>
                      <dd className="mt-1 text-gray-900">{pollingStatus.failuresBeforeDown}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Last Polled</dt>
                      <dd className="mt-1 text-gray-900">
                        {pollingStatus.lastPolled
                          ? new Date(pollingStatus.lastPolled).toLocaleString()
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Next Scheduled</dt>
                      <dd className="mt-1 text-gray-900">
                        {pollingStatus.nextScheduled
                          ? new Date(pollingStatus.nextScheduled).toLocaleString()
                          : '—'}
                      </dd>
                    </div>
                  </dl>

                  {pollResult && (
                    <div className={`mt-4 p-3 rounded-md text-sm ${
                      pollResult.status === 'SUCCESS' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                    }`}>
                      Poll result: <strong>{pollResult.status}</strong> — {pollResult.message}
                      {pollResult.metrics && ` (${pollResult.metrics.latencyMs}ms)`}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500 text-sm">No polling status available.</p>
              )}
            </Card.Body>
          </Card>

          {/* Config */}
          <Card>
            <Card.Header><h2 className="text-lg font-semibold">Polling Configuration</h2></Card.Header>
            <Card.Body>
              {configError && (
                <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-800">
                  {configError}
                </div>
              )}
              {configSuccess && (
                <div className="bg-green-50 border border-green-200 rounded p-3 mb-4 text-sm text-green-800">
                  Configuration saved successfully.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Interval (seconds)"
                  type="number"
                  value={configForm.intervalSeconds}
                  onChange={(e) => setConfigForm((p) => ({ ...p, intervalSeconds: e.target.value }))}
                  fullWidth
                />
                <Input
                  label="Failures Before Down"
                  type="number"
                  value={configForm.failuresBeforeDown}
                  onChange={(e) => setConfigForm((p) => ({ ...p, failuresBeforeDown: e.target.value }))}
                  fullWidth
                />
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={configForm.enabled}
                      onChange={(e) => setConfigForm((p) => ({ ...p, enabled: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Polling enabled</span>
                  </label>
                </div>
              </div>
              <div className="mt-4">
                <Button onClick={handleSaveConfig} isLoading={configSaving}>
                  Save Configuration
                </Button>
              </div>
            </Card.Body>
          </Card>

          {/* History */}
          <Card>
            <Card.Header><h2 className="text-lg font-semibold">Polling History</h2></Card.Header>
            <Card.Body>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <Input
                  label="From Date"
                  type="date"
                  value={historyQuery.fromDate}
                  onChange={(e) => setHistoryQuery((p) => ({ ...p, fromDate: e.target.value }))}
                  fullWidth
                />
                <Input
                  label="To Date"
                  type="date"
                  value={historyQuery.toDate}
                  onChange={(e) => setHistoryQuery((p) => ({ ...p, toDate: e.target.value }))}
                  fullWidth
                />
                <Select
                  label="Status"
                  value={historyQuery.status}
                  onChange={(e) => setHistoryQuery((p) => ({ ...p, status: e.target.value }))}
                  options={[
                    { value: '', label: 'All' },
                    { value: 'SUCCESS', label: 'Success' },
                    { value: 'FAILED', label: 'Failed' }
                  ]}
                  fullWidth
                />
                <Select
                  label="Limit"
                  value={historyQuery.limit}
                  onChange={(e) => setHistoryQuery((p) => ({ ...p, limit: e.target.value }))}
                  options={[
                    { value: '20', label: '20' },
                    { value: '50', label: '50' },
                    { value: '100', label: '100' },
                    { value: '500', label: '500' }
                  ]}
                  fullWidth
                />
              </div>
              <Button
                size="sm"
                onClick={() => fetchHistory(0)}
                isLoading={historyLoading}
              >
                Fetch History
              </Button>

              {historyError && (
                <p className="mt-3 text-sm text-red-600">{historyError}</p>
              )}

              {pollingHistory && (
                <div className="mt-4">
                  {/* Statistics */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 bg-gray-50 rounded-lg p-4">
                    {[
                      { label: 'Success Rate', value: `${pollingHistory.statistics.successRate.toFixed(1)}%` },
                      { label: 'Uptime', value: `${pollingHistory.statistics.uptimePercentage.toFixed(1)}%` },
                      { label: 'Avg Latency', value: `${pollingHistory.statistics.averageResponseTime.toFixed(0)}ms` },
                      { label: 'Min Latency', value: `${pollingHistory.statistics.minResponseTime.toFixed(0)}ms` },
                      { label: 'Max Latency', value: `${pollingHistory.statistics.maxResponseTime.toFixed(0)}ms` }
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center">
                        <div className="text-xs text-gray-500">{label}</div>
                        <div className="font-semibold text-gray-900">{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Results table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="pb-2 pr-4 font-medium">Timestamp</th>
                          <th className="pb-2 pr-4 font-medium">Status</th>
                          <th className="pb-2 pr-4 font-medium">Latency</th>
                          <th className="pb-2 font-medium">Device Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pollingHistory.results.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-gray-400">
                              No results found
                            </td>
                          </tr>
                        ) : (
                          pollingHistory.results.map((r) => (
                            <tr key={r.id} className="border-b border-gray-100">
                              <td className="py-2 pr-4 text-gray-600 whitespace-nowrap">
                                {new Date(r.timestamp).toLocaleString()}
                              </td>
                              <td className="py-2 pr-4">
                                <Badge variant={r.status === 'SUCCESS' ? 'success' : 'danger'}>
                                  {r.status}
                                </Badge>
                              </td>
                              <td className="py-2 pr-4 font-mono">
                                {r.metrics ? `${r.metrics.latencyMs}ms` : '—'}
                              </td>
                              <td className="py-2">
                                <Badge variant={getPollingStatusBadgeVariant(r.deviceStatus)}>
                                  {r.deviceStatus}
                                </Badge>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {pollingHistory.totalCount > parseInt(historyQuery.limit) && (
                    <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
                      <span>
                        {historyQuery.offset + 1}–{Math.min(historyQuery.offset + parseInt(historyQuery.limit), pollingHistory.totalCount)} of {pollingHistory.totalCount}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={historyQuery.offset === 0}
                          onClick={() => fetchHistory(Math.max(0, historyQuery.offset - parseInt(historyQuery.limit)))}
                        >
                          Previous
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={historyQuery.offset + parseInt(historyQuery.limit) >= pollingHistory.totalCount}
                          onClick={() => fetchHistory(historyQuery.offset + parseInt(historyQuery.limit))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card.Body>
          </Card>
        </div>
      )}
      <LocationCreateModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onCreated={(loc) => {
          setLocations((prev) => [...prev, loc]);
          setFormData((prev) => ({ ...prev, locationId: loc.id }));
          setShowLocationModal(false);
        }}
      />
    </div>
  );
}
