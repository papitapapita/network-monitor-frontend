'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { apiService } from '@/services/api.service';
import { DeviceCredentialsResponseDTO } from '@/types/device.types';
import { Card, Button, Input, Badge, LoadingSpinner } from '@/components/ui';

interface Props {
  deviceId: string;
}

const EMPTY_FORM = {
  httpUsername: '',
  httpPassword: '',
  httpPort: '80',
};

export function DeviceCredentialsTab({ deviceId }: Props) {
  const [creds, setCreds] = useState<DeviceCredentialsResponseDTO | null>(null);
  const [noCreds, setNoCreds] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetchCreds = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setNoCreds(false);
    const result = await apiService.getDeviceCredentials(deviceId);
    if (result.success && result.data) {
      setCreds(result.data);
    } else {
      const msg = result.error ?? '';
      if (msg.toLowerCase().includes('no credentials') || msg.toLowerCase().includes('not found')) {
        setNoCreds(true);
      } else {
        setLoadError(msg || 'Error al cargar credenciales');
      }
    }
    setLoading(false);
  }, [deviceId]);

  useEffect(() => {
    fetchCreds();
  }, [fetchCreds]);

  const openForm = () => {
    setForm({
      httpUsername: creds?.httpUsername ?? '',
      httpPassword: '',
      httpPort: String(creds?.httpPort ?? 80),
    });
    setSaveError(null);
    setSaveSuccess(false);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const result = await apiService.setDeviceCredentials(deviceId, {
      httpUsername: form.httpUsername.trim() || null,
      httpPassword: form.httpPassword || null,
      httpPort: form.httpPort ? parseInt(form.httpPort) : undefined,
    });

    if (result.success && result.data) {
      setCreds(result.data);
      setNoCreds(false);
      setSaveSuccess(true);
      setShowForm(false);
    } else {
      setSaveError(result.error || 'Error al guardar credenciales');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    const result = await apiService.deleteDeviceCredentials(deviceId);
    if (result.success) {
      setCreds(null);
      setNoCreds(true);
      setConfirmDelete(false);
    } else {
      setDeleteError(result.error || 'Error al eliminar credenciales');
    }
    setDeleting(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <Card.Header>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Credenciales HTTP / API Web</h2>
            {!showForm && !loading && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={openForm}>
                  {noCreds ? 'Configurar' : 'Editar'}
                </Button>
                {!noCreds && (
                  <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
                    Eliminar
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="flex justify-center py-4">
              <LoadingSpinner message="Cargando credenciales..." />
            </div>
          ) : loadError ? (
            <p className="text-red-600 dark:text-red-400 text-sm">{loadError}</p>
          ) : deleteError ? (
            <p className="text-red-600 dark:text-red-400 text-sm">{deleteError}</p>
          ) : noCreds && !showForm ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No hay credenciales configuradas para este dispositivo. Haga clic en &quot;Configurar&quot; para agregarlas.
            </p>
          ) : creds && !showForm ? (
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Estado</dt>
                <dd className="mt-1">
                  <Badge variant={creds.hasHttpCredentials ? 'success' : 'neutral'}>
                    {creds.hasHttpCredentials ? 'Configuradas' : 'Sin contraseña'}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Usuario</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">{creds.httpUsername ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Contraseña</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono">
                  {creds.httpPassword ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Puerto</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono">{creds.httpPort}</dd>
              </div>
            </dl>
          ) : null}

          {confirmDelete && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300 mb-3">
                ¿Eliminar las credenciales de este dispositivo? Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="danger" onClick={handleDelete} isLoading={deleting}>
                  Eliminar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {showForm && (
            <div className="space-y-4">
              {saveError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 text-sm text-red-800 dark:text-red-400">
                  {saveError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Usuario"
                  value={form.httpUsername}
                  onChange={(e) => setForm((p) => ({ ...p, httpUsername: e.target.value }))}
                  fullWidth
                />
                <Input
                  label="Contraseña"
                  type="password"
                  placeholder={creds?.hasHttpCredentials ? '(dejar vacío para no cambiar)' : ''}
                  value={form.httpPassword}
                  onChange={(e) => setForm((p) => ({ ...p, httpPassword: e.target.value }))}
                  fullWidth
                />
                <Input
                  label="Puerto"
                  type="number"
                  value={form.httpPort}
                  onChange={(e) => setForm((p) => ({ ...p, httpPort: e.target.value }))}
                  fullWidth
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} isLoading={saving}>
                  {noCreds ? 'Guardar' : 'Actualizar'}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {saveSuccess && !showForm && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm text-green-800 dark:text-green-400">
              Credenciales guardadas correctamente.
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
