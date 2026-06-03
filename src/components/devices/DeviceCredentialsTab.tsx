'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { apiService } from '@/services/api.service';
import {
  DeviceCredentialsResponseDTO,
  SetDeviceCredentialsDTO,
} from '@/types/device.types';
import { Card, Button, Input, Select, Badge, LoadingSpinner } from '@/components/ui';

interface Props {
  deviceId: string;
}

type SnmpVersion = 1 | 2 | 3;
type PrivProto = 'DES' | 'AES' | '';

const EMPTY_FORM = {
  snmpVersion: '2' as '1' | '2' | '3',
  snmpCommunity: '',
  snmpV3AuthUser: '',
  snmpV3AuthProto: 'MD5' as 'MD5' | 'SHA',
  snmpV3AuthKey: '',
  snmpV3PrivProto: '' as PrivProto,
  snmpV3PrivKey: '',
  snmpPort: '161',
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
    if (creds) {
      setForm({
        snmpVersion: String(creds.snmpVersion) as '1' | '2' | '3',
        snmpCommunity: '',
        snmpV3AuthUser: creds.snmpV3AuthUser ?? '',
        snmpV3AuthProto: (creds.snmpV3AuthProto ?? 'MD5') as 'MD5' | 'SHA',
        snmpV3AuthKey: '',
        snmpV3PrivProto: (creds.snmpV3PrivProto ?? '') as PrivProto,
        snmpV3PrivKey: '',
        snmpPort: String(creds.snmpPort),
        httpUsername: creds.httpUsername ?? '',
        httpPassword: '',
        httpPort: String(creds.httpPort),
      });
    } else {
      setForm({ ...EMPTY_FORM });
    }
    setSaveError(null);
    setSaveSuccess(false);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const version = parseInt(form.snmpVersion) as SnmpVersion;
    const dto: SetDeviceCredentialsDTO = {
      snmpVersion: version,
      snmpPort: form.snmpPort ? parseInt(form.snmpPort) : undefined,
      httpPort: form.httpPort ? parseInt(form.httpPort) : undefined,
      httpUsername: form.httpUsername.trim() || null,
      httpPassword: form.httpPassword || null,
    };

    if (version === 1 || version === 2) {
      dto.snmpCommunity = form.snmpCommunity || null;
    } else {
      dto.snmpV3AuthUser = form.snmpV3AuthUser.trim() || null;
      dto.snmpV3AuthProto = form.snmpV3AuthProto || null;
      dto.snmpV3AuthKey = form.snmpV3AuthKey || null;
      if (form.snmpV3PrivProto) {
        dto.snmpV3PrivProto = form.snmpV3PrivProto as 'DES' | 'AES';
        dto.snmpV3PrivKey = form.snmpV3PrivKey || null;
      } else {
        dto.snmpV3PrivProto = null;
        dto.snmpV3PrivKey = null;
      }
    }

    const result = await apiService.setDeviceCredentials(deviceId, dto);
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

  const v2 = form.snmpVersion === '1' || form.snmpVersion === '2';
  const hasPriv = form.snmpV3PrivProto !== '';

  return (
    <div className="space-y-6">
      <Card>
        <Card.Header>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Credenciales del Dispositivo</h2>
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
            <div className="space-y-6">
              {/* SNMP */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">SNMP</h3>
                <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">Versión</dt>
                    <dd className="mt-1 text-gray-900 dark:text-gray-100">SNMPv{creds.snmpVersion}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">Puerto</dt>
                    <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono">{creds.snmpPort}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">Credenciales SNMP</dt>
                    <dd className="mt-1">
                      <Badge variant={creds.hasSnmpCredentials ? 'success' : 'neutral'}>
                        {creds.hasSnmpCredentials ? 'Configuradas' : 'No configuradas'}
                      </Badge>
                    </dd>
                  </div>
                  {creds.snmpVersion === 1 || creds.snmpVersion === 2 ? (
                    <div>
                      <dt className="font-medium text-gray-500 dark:text-gray-400">Community</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono">
                        {creds.snmpCommunity ?? '—'}
                      </dd>
                    </div>
                  ) : (
                    <>
                      <div>
                        <dt className="font-medium text-gray-500 dark:text-gray-400">Usuario Auth</dt>
                        <dd className="mt-1 text-gray-900 dark:text-gray-100">{creds.snmpV3AuthUser ?? '—'}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-gray-500 dark:text-gray-400">Protocolo Auth</dt>
                        <dd className="mt-1 text-gray-900 dark:text-gray-100">{creds.snmpV3AuthProto ?? '—'}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-gray-500 dark:text-gray-400">Auth Key</dt>
                        <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono">{creds.snmpV3AuthKey ?? '—'}</dd>
                      </div>
                      {creds.snmpV3PrivProto && (
                        <>
                          <div>
                            <dt className="font-medium text-gray-500 dark:text-gray-400">Protocolo Privacidad</dt>
                            <dd className="mt-1 text-gray-900 dark:text-gray-100">{creds.snmpV3PrivProto}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-gray-500 dark:text-gray-400">Priv Key</dt>
                            <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono">{creds.snmpV3PrivKey ?? '—'}</dd>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </dl>
              </div>

              {/* HTTP */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">HTTP / API Web</h3>
                <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">Credenciales HTTP</dt>
                    <dd className="mt-1">
                      <Badge variant={creds.hasHttpCredentials ? 'success' : 'neutral'}>
                        {creds.hasHttpCredentials ? 'Configuradas' : 'No configuradas'}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">Usuario</dt>
                    <dd className="mt-1 text-gray-900 dark:text-gray-100">{creds.httpUsername ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">Puerto HTTP</dt>
                    <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono">{creds.httpPort}</dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : null}

          {/* Confirm delete */}
          {confirmDelete && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300 mb-3">
                ¿Eliminar todas las credenciales de este dispositivo? Esta acción no se puede deshacer.
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

          {/* Credential form */}
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
                  <Select
                    label="Versión SNMP"
                    value={form.snmpVersion}
                    onChange={(e) => setForm((p) => ({ ...p, snmpVersion: e.target.value as '1' | '2' | '3' }))}
                    options={[
                      { value: '1', label: 'SNMPv1 (AirOS legacy)' },
                      { value: '2', label: 'SNMPv2c' },
                      { value: '3', label: 'SNMPv3' },
                    ]}
                    fullWidth
                  />
                  <Input
                    label="Puerto SNMP"
                    type="number"
                    value={form.snmpPort}
                    onChange={(e) => setForm((p) => ({ ...p, snmpPort: e.target.value }))}
                    fullWidth
                  />

                  {v2 ? (
                    <Input
                      label="Community String"
                      placeholder="public"
                      value={form.snmpCommunity}
                      onChange={(e) => setForm((p) => ({ ...p, snmpCommunity: e.target.value }))}
                      fullWidth
                    />
                  ) : (
                    <>
                      <Input
                        label="Usuario Auth"
                        value={form.snmpV3AuthUser}
                        onChange={(e) => setForm((p) => ({ ...p, snmpV3AuthUser: e.target.value }))}
                        fullWidth
                      />
                      <Select
                        label="Protocolo Auth"
                        value={form.snmpV3AuthProto}
                        onChange={(e) => setForm((p) => ({ ...p, snmpV3AuthProto: e.target.value as 'MD5' | 'SHA' }))}
                        options={[
                          { value: 'MD5', label: 'MD5' },
                          { value: 'SHA', label: 'SHA' },
                        ]}
                        fullWidth
                      />
                      <Input
                        label="Auth Key (contraseña)"
                        type="password"
                        placeholder={creds?.hasSnmpCredentials ? '(sin cambios si vacío)' : ''}
                        value={form.snmpV3AuthKey}
                        onChange={(e) => setForm((p) => ({ ...p, snmpV3AuthKey: e.target.value }))}
                        fullWidth
                      />
                      <Select
                        label="Protocolo Privacidad (opcional)"
                        value={form.snmpV3PrivProto}
                        onChange={(e) => setForm((p) => ({ ...p, snmpV3PrivProto: e.target.value as PrivProto }))}
                        options={[
                          { value: '', label: 'Ninguno' },
                          { value: 'DES', label: 'DES' },
                          { value: 'AES', label: 'AES' },
                        ]}
                        fullWidth
                      />
                      {hasPriv && (
                        <Input
                          label="Priv Key"
                          type="password"
                          placeholder={creds?.hasSnmpCredentials ? '(sin cambios si vacío)' : ''}
                          value={form.snmpV3PrivKey}
                          onChange={(e) => setForm((p) => ({ ...p, snmpV3PrivKey: e.target.value }))}
                          fullWidth
                        />
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* HTTP section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">HTTP / API Web (opcional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Usuario HTTP"
                    value={form.httpUsername}
                    onChange={(e) => setForm((p) => ({ ...p, httpUsername: e.target.value }))}
                    fullWidth
                  />
                  <Input
                    label="Contraseña HTTP"
                    type="password"
                    placeholder={creds?.hasHttpCredentials ? '(sin cambios si vacío)' : ''}
                    value={form.httpPassword}
                    onChange={(e) => setForm((p) => ({ ...p, httpPassword: e.target.value }))}
                    fullWidth
                  />
                  <Input
                    label="Puerto HTTP"
                    type="number"
                    value={form.httpPort}
                    onChange={(e) => setForm((p) => ({ ...p, httpPort: e.target.value }))}
                    fullWidth
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} isLoading={saving}>
                  {noCreds ? 'Guardar Credenciales' : 'Actualizar Credenciales'}
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

      {/* Info card */}
      <Card>
        <Card.Header>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Información</h2>
        </Card.Header>
        <Card.Body>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
            <li>Las contraseñas y claves son almacenadas de forma segura y nunca se muestran en texto plano.</li>
            <li>SNMPv2c usa una community string. SNMPv3 usa autenticación por usuario con cifrado opcional.</li>
            <li>Las credenciales HTTP se usan para acceder a la API web del dispositivo (RouterOS, etc.).</li>
            <li>Guardar nuevas credenciales reemplaza las anteriores completamente.</li>
          </ul>
        </Card.Body>
      </Card>
    </div>
  );
}
