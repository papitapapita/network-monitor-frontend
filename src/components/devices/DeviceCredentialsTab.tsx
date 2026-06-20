'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { apiService } from '@/services/api.service';
import { DeviceCredentialsResponseDTO } from '@/types/device.types';
import { Card, Button, Input, Badge, LoadingSpinner } from '@/components/ui';

interface Props {
  deviceId: string;
}

const EMPTY_FORM = {
  snmpVersion: '2' as '1' | '2' | '3',
  snmpCommunity: '',
  snmpV3AuthUser: '',
  snmpV3AuthProto: '' as '' | 'MD5' | 'SHA',
  snmpV3AuthKey: '',
  snmpV3PrivProto: '' as '' | 'DES' | 'AES',
  snmpV3PrivKey: '',
  snmpPort: '161',
  httpUsername: '',
  httpPassword: '',
  httpPort: '80',
};

type FormState = typeof EMPTY_FORM;

export function DeviceCredentialsTab({ deviceId }: Props) {
  const [creds, setCreds] = useState<DeviceCredentialsResponseDTO | null>(null);
  const [noCreds, setNoCreds] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
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
      snmpVersion: String(creds?.snmpVersion ?? 2) as '1' | '2' | '3',
      snmpCommunity: '',
      snmpV3AuthUser: creds?.snmpV3AuthUser ?? '',
      snmpV3AuthProto: creds?.snmpV3AuthProto ?? '',
      snmpV3AuthKey: '',
      snmpV3PrivProto: creds?.snmpV3PrivProto ?? '',
      snmpV3PrivKey: '',
      snmpPort: String(creds?.snmpPort ?? 161),
      httpUsername: creds?.httpUsername ?? '',
      httpPassword: '',
      httpPort: String(creds?.httpPort ?? 80),
    });
    setSaveError(null);
    setSaveSuccess(false);
    setShowForm(true);
  };

  const field = (key: keyof FormState, value: string) =>
    setForm((p) => ({ ...p, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const v = form.snmpVersion;
    // When editing, omit secret fields that were left blank so the backend keeps
    // the existing stored secrets. Only include them when explicitly changed.
    const isEditing = !noCreds;
    const keepIfBlank = (val: string) => (val ? val : isEditing ? undefined : null);

    const body: Parameters<typeof apiService.setDeviceCredentials>[1] = {
      snmpVersion: Number(v) as 1 | 2 | 3,
      snmpPort: form.snmpPort ? parseInt(form.snmpPort) : undefined,
      httpUsername: form.httpUsername.trim() || null,
      httpPassword: keepIfBlank(form.httpPassword),
      httpPort: form.httpPort ? parseInt(form.httpPort) : undefined,
    };

    if (v === '1' || v === '2') {
      body.snmpCommunity = keepIfBlank(form.snmpCommunity);
    } else {
      body.snmpV3AuthUser = form.snmpV3AuthUser.trim() || null;
      body.snmpV3AuthProto = (form.snmpV3AuthProto as 'MD5' | 'SHA') || null;
      body.snmpV3AuthKey = keepIfBlank(form.snmpV3AuthKey);
      body.snmpV3PrivProto = (form.snmpV3PrivProto as 'DES' | 'AES') || null;
      body.snmpV3PrivKey = keepIfBlank(form.snmpV3PrivKey);
    }

    const result = await apiService.setDeviceCredentials(deviceId, body);

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

  const snmpV = form.snmpVersion;

  return (
    <div className="space-y-6">
      {/* HTTP credentials */}
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
                <dt className="font-medium text-gray-500 dark:text-gray-400">Estado HTTP</dt>
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
                <dt className="font-medium text-gray-500 dark:text-gray-400">Puerto HTTP</dt>
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
            <div className="space-y-6">
              {saveError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 text-sm text-red-800 dark:text-red-400">
                  {saveError}
                </div>
              )}

              {/* SNMP section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">SNMP</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Versión SNMP
                    </label>
                    <select
                      value={snmpV}
                      onChange={(e) => field('snmpVersion', e.target.value as '1' | '2' | '3')}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="1">SNMPv1</option>
                      <option value="2">SNMPv2c</option>
                      <option value="3">SNMPv3</option>
                    </select>
                  </div>
                  <Input
                    label="Puerto SNMP"
                    type="number"
                    value={form.snmpPort}
                    onChange={(e) => field('snmpPort', e.target.value)}
                    fullWidth
                  />
                </div>

                {(snmpV === '1' || snmpV === '2') && (
                  <div className="mt-4">
                    <Input
                      label="Community string"
                      value={form.snmpCommunity}
                      placeholder={creds?.snmpCommunity ? '(dejar vacío para no cambiar)' : ''}
                      onChange={(e) => field('snmpCommunity', e.target.value)}
                      fullWidth
                    />
                  </div>
                )}

                {snmpV === '3' && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Usuario auth"
                      value={form.snmpV3AuthUser}
                      onChange={(e) => field('snmpV3AuthUser', e.target.value)}
                      fullWidth
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Protocolo auth
                      </label>
                      <select
                        value={form.snmpV3AuthProto}
                        onChange={(e) => field('snmpV3AuthProto', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— ninguno —</option>
                        <option value="MD5">MD5</option>
                        <option value="SHA">SHA</option>
                      </select>
                    </div>
                    <Input
                      label="Clave auth"
                      type="password"
                      value={form.snmpV3AuthKey}
                      placeholder={creds?.snmpV3AuthKey ? '(dejar vacío para no cambiar)' : ''}
                      onChange={(e) => field('snmpV3AuthKey', e.target.value)}
                      fullWidth
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Protocolo privacidad
                      </label>
                      <select
                        value={form.snmpV3PrivProto}
                        onChange={(e) => field('snmpV3PrivProto', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— ninguno —</option>
                        <option value="DES">DES</option>
                        <option value="AES">AES</option>
                      </select>
                    </div>
                    {form.snmpV3PrivProto && (
                      <Input
                        label="Clave privacidad"
                        type="password"
                        value={form.snmpV3PrivKey}
                        placeholder={creds?.snmpV3PrivKey ? '(dejar vacío para no cambiar)' : ''}
                        onChange={(e) => field('snmpV3PrivKey', e.target.value)}
                        fullWidth
                      />
                    )}
                  </div>
                )}
              </div>

              {/* HTTP section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">HTTP / API Web</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Usuario"
                    value={form.httpUsername}
                    onChange={(e) => field('httpUsername', e.target.value)}
                    fullWidth
                  />
                  <Input
                    label="Contraseña"
                    type="password"
                    placeholder={creds?.hasHttpCredentials ? '(dejar vacío para no cambiar)' : ''}
                    value={form.httpPassword}
                    onChange={(e) => field('httpPassword', e.target.value)}
                    fullWidth
                  />
                  <Input
                    label="Puerto HTTP"
                    type="number"
                    value={form.httpPort}
                    onChange={(e) => field('httpPort', e.target.value)}
                    fullWidth
                  />
                </div>
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

      {/* SNMP summary (read-only) */}
      {creds && !showForm && (
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">SNMP</h2>
          </Card.Header>
          <Card.Body>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Estado SNMP</dt>
                <dd className="mt-1">
                  <Badge variant={creds.hasSnmpCredentials ? 'success' : 'neutral'}>
                    {creds.hasSnmpCredentials ? 'Configurado' : 'Sin credenciales'}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Versión</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono">
                  {creds.snmpVersion === 1 ? 'SNMPv1' : creds.snmpVersion === 2 ? 'SNMPv2c' : 'SNMPv3'}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Puerto</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono">{creds.snmpPort}</dd>
              </div>
              {(creds.snmpVersion === 1 || creds.snmpVersion === 2) && (
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Community</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono">{creds.snmpCommunity ?? '—'}</dd>
                </div>
              )}
              {creds.snmpVersion === 3 && (
                <>
                  <div>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">Usuario auth</dt>
                    <dd className="mt-1 text-gray-900 dark:text-gray-100">{creds.snmpV3AuthUser ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">Protocolo auth</dt>
                    <dd className="mt-1 text-gray-900 dark:text-gray-100">{creds.snmpV3AuthProto ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">Protocolo priv.</dt>
                    <dd className="mt-1 text-gray-900 dark:text-gray-100">{creds.snmpV3PrivProto ?? '—'}</dd>
                  </div>
                </>
              )}
            </dl>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
