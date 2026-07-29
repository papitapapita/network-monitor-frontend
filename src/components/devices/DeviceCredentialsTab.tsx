'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { apiService } from '@/services/api.service';
import { DeviceCredentialsResponseDTO, SetDeviceCredentialsDTO } from '@/types/device.types';
import { Card, Button, Input, Badge, LoadingSpinner } from '@/components/ui';

interface Props {
  deviceId: string;
}

const EMPTY_FORM = {
  // HTTP is the required pair — the backend replaces it on every call.
  httpUsername: '',
  httpPassword: '',
  httpPort: '443',
  // SNMP is optional: when the toggle is off we send no snmp* key at all, which
  // tells the backend to keep whatever is stored.
  snmpEnabled: false,
  snmpVersion: '2' as '1' | '2' | '3',
  snmpCommunity: '',
  snmpV3AuthUser: '',
  snmpV3AuthProto: '' as '' | 'MD5' | 'SHA',
  snmpV3AuthKey: '',
  snmpV3PrivProto: '' as '' | 'DES' | 'AES',
  snmpV3PrivKey: '',
  snmpPort: '161',
};

type FormState = typeof EMPTY_FORM;

function invalidPort(value: string): boolean {
  if (!value) return false;
  const port = Number(value);
  return !Number.isInteger(port) || port < 1 || port > 65535;
}

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
      httpUsername: creds?.httpUsername ?? '',
      httpPassword: '',
      httpPort: String(creds?.httpPort ?? 443),
      snmpEnabled: creds?.hasSnmpCredentials ?? false,
      snmpVersion: String(creds?.snmpVersion ?? 2) as '1' | '2' | '3',
      snmpCommunity: '',
      snmpV3AuthUser: creds?.snmpV3AuthUser ?? '',
      snmpV3AuthProto: creds?.snmpV3AuthProto ?? '',
      snmpV3AuthKey: '',
      snmpV3PrivProto: creds?.snmpV3PrivProto ?? '',
      snmpV3PrivKey: '',
      snmpPort: String(creds?.snmpPort ?? 161),
    });
    setSaveError(null);
    setSaveSuccess(false);
    setShowForm(true);
  };

  const field = (key: keyof FormState, value: string | boolean) =>
    setForm((p) => ({ ...p, [key]: value }));

  const validate = (): string | null => {
    if (!form.httpUsername.trim()) return 'El usuario HTTP es obligatorio.';
    // The backend replaces the HTTP pair on every call and rejects a blank
    // password, so it must be re-entered even when editing.
    if (!form.httpPassword) return 'La contraseña HTTP es obligatoria.';
    if (invalidPort(form.httpPort)) return 'El puerto HTTP debe estar entre 1 y 65535.';

    if (form.snmpEnabled) {
      if (invalidPort(form.snmpPort)) return 'El puerto SNMP debe estar entre 1 y 65535.';
      const isNew = !creds?.hasSnmpCredentials;
      if (form.snmpVersion === '3') {
        if (!form.snmpV3AuthUser.trim()) return 'El usuario de autenticación SNMPv3 es obligatorio.';
        if (!form.snmpV3AuthProto) return 'El protocolo de autenticación SNMPv3 es obligatorio.';
        if (isNew && !form.snmpV3AuthKey) return 'La clave de autenticación SNMPv3 es obligatoria.';
        if (form.snmpV3PrivProto && isNew && !form.snmpV3PrivKey) {
          return 'La clave de privacidad es obligatoria cuando se elige un protocolo de privacidad.';
        }
      } else if (isNew && !form.snmpCommunity) {
        return 'El community string es obligatorio para SNMPv1/v2c.';
      }
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const body: SetDeviceCredentialsDTO = {
      httpUsername: form.httpUsername.trim(),
      httpPassword: form.httpPassword,
      httpPort: form.httpPort ? parseInt(form.httpPort) : undefined,
    };

    if (form.snmpEnabled) {
      // Omit a secret left blank so the backend keeps the stored one; only send
      // an explicit null when there is nothing stored to keep.
      const hadSnmp = creds?.hasSnmpCredentials ?? false;
      const keepIfBlank = (val: string) => (val ? val : hadSnmp ? undefined : null);

      body.snmpVersion = Number(form.snmpVersion) as 1 | 2 | 3;
      body.snmpPort = form.snmpPort ? parseInt(form.snmpPort) : undefined;

      if (form.snmpVersion === '1' || form.snmpVersion === '2') {
        body.snmpCommunity = keepIfBlank(form.snmpCommunity);
      } else {
        body.snmpV3AuthUser = form.snmpV3AuthUser.trim() || null;
        body.snmpV3AuthProto = (form.snmpV3AuthProto as 'MD5' | 'SHA') || null;
        body.snmpV3AuthKey = keepIfBlank(form.snmpV3AuthKey);
        body.snmpV3PrivProto = (form.snmpV3PrivProto as 'DES' | 'AES') || null;
        body.snmpV3PrivKey = form.snmpV3PrivProto ? keepIfBlank(form.snmpV3PrivKey) : null;
      }
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
      {/* HTTP credentials — the required pair */}
      <Card>
        <Card.Header>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Credenciales HTTP / API Web</h2>
            {!showForm && !loading && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={openForm} data-testid="credentials-edit">
                  {noCreds ? 'Configurar' : 'Editar'}
                </Button>
                {!noCreds && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setConfirmDelete(true)}
                    data-testid="credentials-delete"
                  >
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
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleDelete}
                  isLoading={deleting}
                  data-testid="credentials-delete-confirm"
                >
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

              {/* HTTP section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  HTTP / API Web <span className="font-normal text-gray-500 dark:text-gray-400">(requerido)</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Usadas por el sondeo AirOS y el reinicio remoto. El backend reemplaza el par completo en
                  cada guardado, por lo que la contraseña debe volver a escribirse.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Usuario *"
                    value={form.httpUsername}
                    onChange={(e) => field('httpUsername', e.target.value)}
                    fullWidth
                  />
                  <Input
                    label="Contraseña *"
                    type="password"
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

              {/* SNMP section — optional */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.snmpEnabled}
                    onChange={(e) => field('snmpEnabled', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Configurar SNMP
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    (opcional — aún no lo consume ningún colector)
                  </span>
                </label>

                {form.snmpEnabled && (
                  <div className="mt-4">
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
                )}
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
      {creds?.hasSnmpCredentials && !showForm && (
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">SNMP</h2>
          </Card.Header>
          <Card.Body>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Estado SNMP</dt>
                <dd className="mt-1">
                  <Badge variant="success">Configurado</Badge>
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
