'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api.service';
import {
  DeviceModelResponseDTO,
  DeviceOwnerType,
  CreateDeviceDTO,
} from '@/types/device.types';
import { DiscoveredHost, NetworkScanResult } from '@/types/network-scan.types';
import {
  Button,
  Input,
  Select,
  Table,
  TableEmptyState,
  LoadingSpinner,
  Modal,
} from '@/components/ui';

function isValidCidr(value: string): boolean {
  const cidrRe = /^(\d{1,3}\.){3}\d{1,3}\/(\d|[1-2]\d|3[0-2])$/;
  if (!cidrRe.test(value)) return false;
  const [ip, prefix] = value.split('/');
  const parts = ip.split('.').map(Number);
  if (parts.some((p) => p > 255)) return false;
  return Number(prefix) >= 0 && Number(prefix) <= 32;
}

interface AddDeviceModalProps {
  host: DiscoveredHost;
  deviceModels: DeviceModelResponseDTO[];
  onClose: () => void;
  onAdded: (ip: string) => void;
}

function AddDeviceModal({ host, deviceModels, onClose, onAdded }: AddDeviceModalProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    deviceModelId: '',
    ownerType: '' as DeviceOwnerType | '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'El nombre es requerido';
    if (!form.deviceModelId) e.deviceModelId = 'El modelo es requerido';
    if (!form.ownerType) e.ownerType = 'El tipo de propietario es requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setApiError(null);

    const dto: CreateDeviceDTO = {
      name: form.name.trim(),
      deviceModelId: form.deviceModelId,
      ownerType: form.ownerType as DeviceOwnerType,
      ipAddress: host.ipAddress,
      macAddress: host.macAddress ?? undefined,
      status: 'ACTIVE',
    };

    const res = await apiService.createDevice(dto);
    if (res.success && res.data) {
      onAdded(host.ipAddress);
      router.push(`/devices/${res.data.id}`);
    } else {
      setApiError(res.error || 'Error al crear el dispositivo');
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Agregar Dispositivo" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {apiError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-sm text-red-800 dark:text-red-400">{apiError}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="Dirección IP" value={host.ipAddress} disabled fullWidth />
          <Input label="MAC" value={host.macAddress ?? '—'} disabled fullWidth />
        </div>

        <Input
          label="Nombre"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Router-01"
          error={errors.name}
          required
          fullWidth
        />

        <Select
          label="Modelo de Dispositivo"
          name="deviceModelId"
          value={form.deviceModelId}
          onChange={handleChange}
          options={[
            { value: '', label: 'Seleccionar modelo' },
            ...deviceModels.map((m) => ({
              value: m.id,
              label: `${m.vendorName} — ${m.model}`,
            })),
          ]}
          error={errors.deviceModelId}
          required
          fullWidth
        />

        <Select
          label="Tipo de Propietario"
          name="ownerType"
          value={form.ownerType}
          onChange={handleChange}
          options={[
            { value: '', label: 'Seleccionar tipo' },
            { value: 'COMPANY', label: 'Empresa' },
            { value: 'CLIENT', label: 'Cliente' },
          ]}
          error={errors.ownerType}
          required
          fullWidth
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={submitting}>
            Crear Dispositivo
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function NetworkScanPage() {
  const [segment, setSegment] = useState('');
  const [segmentError, setSegmentError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [result, setResult] = useState<NetworkScanResult | null>(null);

  const [deviceModels, setDeviceModels] = useState<DeviceModelResponseDTO[]>([]);
  const [addingHost, setAddingHost] = useState<DiscoveredHost | null>(null);
  const [addedIps, setAddedIps] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiService.listDeviceModels({ limit: 100 }).then((res) => {
      if (res.success && res.data) setDeviceModels(res.data.deviceModels);
    });
  }, []);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidCidr(segment.trim())) {
      setSegmentError('Ingresa un bloque CIDR válido, ej. 192.168.1.0/24 (máximo /22)');
      return;
    }
    setSegmentError(null);
    setScanError(null);
    setResult(null);
    setAddedIps(new Set());
    setIsScanning(true);

    const res = await apiService.scanNetwork({ segment: segment.trim() });
    if (res.success && res.data) {
      setResult(res.data);
    } else {
      setScanError(res.error || 'Error al escanear la red');
    }
    setIsScanning(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Escaneo de Red</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Descubre hosts activos en un segmento de red
        </p>
      </div>

      {/* Scan form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <Input
              label="Segmento CIDR"
              value={segment}
              onChange={(e) => { setSegment(e.target.value); setSegmentError(null); }}
              placeholder="192.168.1.0/24"
              error={segmentError ?? undefined}
              fullWidth
            />
          </div>
          <Button type="submit" isLoading={isScanning} disabled={isScanning || !segment.trim()}>
            {isScanning ? 'Escaneando…' : 'Escanear'}
          </Button>
        </form>
      </div>

      {scanError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{scanError}</p>
        </div>
      )}

      {isScanning && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" message="Escaneando red…" />
        </div>
      )}

      {result && !isScanning && (
        <>
          <div className="flex items-center gap-6 mb-4 text-sm text-gray-600 dark:text-gray-400">
            <span>Segmento: <strong className="text-gray-900 dark:text-gray-100">{result.segment}</strong></span>
            <span>IPs escaneadas: <strong className="text-gray-900 dark:text-gray-100">{result.scannedCount}</strong></span>
            <span>
              Hosts encontrados:{' '}
              <strong className="text-green-700 dark:text-green-400">{result.responsiveCount}</strong>
            </span>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <Table>
              <Table.Header>
                <Table.Head>Dirección IP</Table.Head>
                <Table.Head>Latencia</Table.Head>
                <Table.Head>MAC</Table.Head>
                <Table.Head>Fabricante</Table.Head>
                <Table.Head> </Table.Head>
              </Table.Header>
              <Table.Body>
                {result.discoveredHosts.length === 0 ? (
                  <TableEmptyState message="No se encontraron hosts activos en el segmento." />
                ) : (
                  result.discoveredHosts.map((host) => (
                    <Table.Row key={host.ipAddress}>
                      <Table.Cell>
                        <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                          {host.ipAddress}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {host.latencyMs} ms
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                          {host.macAddress ?? '—'}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {host.manufacturer ?? '—'}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        {addedIps.has(host.ipAddress) ? (
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                            Agregado
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAddingHost(host)}
                          >
                            Agregar
                          </Button>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table>
          </div>
        </>
      )}

      {addingHost && (
        <AddDeviceModal
          host={addingHost}
          deviceModels={deviceModels}
          onClose={() => setAddingHost(null)}
          onAdded={(ip) => {
            setAddedIps((prev) => new Set(prev).add(ip));
            setAddingHost(null);
          }}
        />
      )}
    </div>
  );
}
