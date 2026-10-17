'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { apiService } from '@/services/api.service';
import { DeviceCredentialsResponseDTO, RevealedDeviceCredentialsDTO, SetDeviceCredentialsDTO } from '@/types/device.types';
import { Card, Input, Checkbox, Badge, Button, LoadingSpinner, IconButton, EditFormActions, EditToggleButton, ConfirmModal, InfoTip, SectionTitle, Modal, EyeIcon, EyeOffIcon } from '@/components/ui';
import { getRevealUnlock, setRevealUnlock, clearRevealUnlock } from '@/services/credentialReveal';
import { useToast } from '@/contexts/toast.context';
import { usePermissions } from '@/hooks/usePermissions';
import { wirelessCollectorFor } from '@/constants/wireless.constants';

interface Props {
  deviceId: string;
  /** Of the device's model. Decides which credentials the wireless poller reads, and so which the form asks for first. */
  vendorSlug: string | null;
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

const EMPTY_FORM = {
  // The backend keeps an omitted HTTP pair, so the password only needs typing
  // when it changes.
  httpUsername: '',
  httpPassword: '',
  httpPort: '443',
  sshPort: '22',
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

/**
 * The write endpoints answer 403 to anyone but an admin. The buttons are hidden
 * for them, so this only shows when the role changed under an open session —
 * the raw answer is in English and says nothing about who may do it.
 */
const forbidden = (result: { status?: number; error?: string }): string | null =>
  result.status === 403
    ? 'Solo un administrador puede modificar las credenciales de un dispositivo.'
    : null;

/** The backend's credential refusals (DEV-133), in the dashboard's language. */
const SAVE_ERRORS: Record<string, string> = {
  'An HTTP login or SNMP access is required': 'El dispositivo necesita un usuario HTTP, acceso SNMP o ambos.',
  'httpUsername and httpPassword must be set together': 'El usuario y la contraseña HTTP van juntos.',
};

function invalidPort(value: string): boolean {
  if (!value) return false;
  const port = Number(value);
  return !Number.isInteger(port) || port < 1 || port > 65535;
}

export function DeviceCredentialsTab({ deviceId, vendorSlug }: Props) {
  // These endpoints carry device passwords and SNMP keys, so writing them is its
  // own permission — an operator who may edit the device still cannot touch
  // them. Reading stays open to everyone: the response is masked.
  const permissions = usePermissions();
  const canManage = permissions.isAdmin;
  // Seeing them in plaintext is its own permission too (IDN-035): operators
  // hold it, viewers do not, and it costs a password re-check every 5 minutes.
  const canReveal = permissions.canRevealCredentials;
  // Mimosa radios are polled over SNMP only, so SNMP leads the form and is
  // required there, and HTTP is optional. Every other device needs the HTTP
  // login: AirOS polling, reboots and MikroTik backups all log in with it.
  const snmpFirst = wirelessCollectorFor(vendorSlug ?? '')?.credentials === 'snmp';

  const [creds, setCreds] = useState<DeviceCredentialsResponseDTO | null>(null);
  const [noCreds, setNoCreds] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { showError, showSuccess } = useToast();

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Plaintext secrets, held only while the unlock that bought them lasts.
  const [revealed, setRevealed] = useState<RevealedDeviceCredentialsDTO | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [revealedUntil, setRevealedUntil] = useState<number | null>(null);

  const hideSecrets = useCallback(() => {
    setRevealed(null);
    setRevealedUntil(null);
  }, []);

  // Hide them again the moment the unlock runs out, as the API asks.
  useEffect(() => {
    if (revealedUntil === null) return;
    const timer = setTimeout(hideSecrets, Math.max(0, revealedUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [revealedUntil, hideSecrets]);

  const askPassword = () => {
    setUnlockPassword('');
    setUnlockError(null);
    setShowUnlock(true);
  };

  const reveal = async (unlock: { token: string; expiresAt: number }) => {
    setRevealing(true);
    const result = await apiService.revealDeviceCredentials(deviceId, unlock.token);
    setRevealing(false);
    if (result.success && result.data) {
      setRevealed(result.data);
      setRevealedUntil(unlock.expiresAt);
    } else if (result.errorField === 'revealToken') {
      // Expired early: a password or role change ended the account's sessions.
      clearRevealUnlock();
      askPassword();
    } else {
      showError(result.error || 'No se pudieron mostrar las credenciales');
    }
  };

  const handleRevealToggle = () => {
    if (revealed) {
      hideSecrets();
      return;
    }
    const unlock = getRevealUnlock();
    if (unlock) reveal(unlock);
    else askPassword();
  };

  const handleUnlock = async () => {
    if (!unlockPassword) {
      setUnlockError('Escribe tu contraseña.');
      return;
    }
    setUnlocking(true);
    setUnlockError(null);
    const result = await apiService.unlockCredentialReveal(unlockPassword);
    setUnlocking(false);
    if (result.success && result.data) {
      setRevealUnlock(result.data.revealToken, result.data.expiresInSeconds);
      setShowUnlock(false);
      setUnlockPassword('');
      const unlock = getRevealUnlock();
      if (unlock) await reveal(unlock);
    } else {
      setUnlockError(result.error || 'No se pudo verificar la contraseña');
    }
  };

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
      sshPort: String(creds?.sshPort ?? 22),
      snmpEnabled: snmpFirst || (creds?.hasSnmpCredentials ?? false),
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
    setShowForm(true);
  };

  const field = (key: keyof FormState, value: string | boolean) =>
    setForm((p) => ({ ...p, [key]: value }));

  const hadHttp = creds?.hasHttpCredentials ?? false;
  const httpUsername = form.httpUsername.trim();
  // A stored login under the same username is kept when the password is blank.
  const keepsHttp = hadHttp && httpUsername === creds?.httpUsername && !form.httpPassword;

  const validateHttp = (): string | null => {
    const optional = snmpFirst && !httpUsername && !form.httpPassword;
    if (!optional) {
      if (!httpUsername) return 'El usuario HTTP es obligatorio.';
      if (!form.httpPassword && !keepsHttp) {
        // The backend takes the pair together, so a new username needs the password again.
        return hadHttp
          ? 'Para cambiar el usuario HTTP vuelve a escribir la contraseña.'
          : 'La contraseña HTTP es obligatoria.';
      }
    }
    if (invalidPort(form.httpPort)) return 'El puerto HTTP debe estar entre 1 y 65535.';
    if (invalidPort(form.sshPort)) return 'El puerto SSH debe estar entre 1 y 65535.';
    return null;
  };

  const validateSnmp = (): string | null => {
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

  // Report the first problem in the order the form shows its sections.
  const validate = (): string | null =>
    snmpFirst ? validateSnmp() ?? validateHttp() : validateHttp() ?? validateSnmp();

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setSaveError(validationError);
      // The SNMP rules live at the bottom of a long form, well past the notice
      // at its top, so the refusal has to travel to wherever the operator is.
      showError(validationError);
      return;
    }

    setSaving(true);
    setSaveError(null);

    const body: SetDeviceCredentialsDTO = {
      httpPort: form.httpPort ? parseInt(form.httpPort) : undefined,
      sshPort: form.sshPort ? parseInt(form.sshPort) : undefined,
    };
    // Omitting the pair keeps the stored login; both blank clears it.
    if (httpUsername && form.httpPassword) {
      body.httpUsername = httpUsername;
      body.httpPassword = form.httpPassword;
    } else if (!httpUsername && !form.httpPassword && (creds?.httpUsername != null || hadHttp)) {
      body.httpUsername = null;
      body.httpPassword = null;
    }

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
      hideSecrets();
      showSuccess('Credenciales guardadas.');
      setShowForm(false);
    } else {
      const message =
        forbidden(result) ??
        (result.error ? SAVE_ERRORS[result.error] ?? result.error : 'Error al guardar credenciales');
      setSaveError(message);
      showError(message);
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
      hideSecrets();
      setConfirmDelete(false);
      showSuccess('Credenciales eliminadas.');
    } else {
      const message = forbidden(result) ?? result.error ?? 'Error al eliminar credenciales';
      setDeleteError(message);
      showError(message);
    }
    setDeleting(false);
  };

  const snmpV = form.snmpVersion;

  const httpSection = (
  <div>
    <div className="mb-3">
      <SectionTitle
        as="h3"
        info={
          snmpFirst
            ? 'Este equipo se sondea por SNMP y no las necesita. Deje usuario y contraseña vacíos para no guardar ninguna, o para borrar las que ya tenga.'
            : 'Usadas por el sondeo inalámbrico de equipos Ubiquiti (AirOS), el reinicio remoto y los respaldos de MikroTik. Deje la contraseña vacía para conservar la guardada.'
        }
      >
        HTTP / API Web{' '}
        <span className="font-normal text-gray-500 dark:text-gray-400">
          {snmpFirst ? '(opcional)' : '(requerido)'}
        </span>
      </SectionTitle>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Input
        label={snmpFirst ? 'Usuario' : 'Usuario *'}
        value={form.httpUsername}
        onChange={(e) => field('httpUsername', e.target.value)}
        fullWidth
      />
      <Input
        label={snmpFirst || hadHttp ? 'Contraseña' : 'Contraseña *'}
        type="password"
        value={form.httpPassword}
        placeholder={hadHttp ? '(dejar vacío para no cambiar)' : ''}
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
      <Input
        label="Puerto SSH"
        type="number"
        value={form.sshPort}
        onChange={(e) => field('sshPort', e.target.value)}
        info="Los respaldos de MikroTik entran por SSH en este puerto, con el mismo usuario y contraseña."
        fullWidth
      />
    </div>
  </div>
  );

  const snmpSection = (
  <div>
    {snmpFirst ? (
      <SectionTitle as="h3" info="Los equipos Mimosa se sondean solo por SNMP.">
        SNMP <span className="font-normal text-gray-500 dark:text-gray-400">(requerido)</span>
      </SectionTitle>
    ) : (
      <div className="flex items-center gap-2">
        <Checkbox
          id="snmpEnabled"
          checked={form.snmpEnabled}
          onChange={(e) => field('snmpEnabled', e.target.checked)}
          label="Configurar SNMP"
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">(opcional)</span>
        <InfoTip label="Acerca de SNMP">
          Usado por el sondeo inalámbrico de equipos Mimosa. Los demás equipos no lo necesitan.
        </InfoTip>
      </div>
    )}

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
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
  );

  const snmpSummary = creds?.hasSnmpCredentials && !showForm && (
    <Card>
      <Card.Header>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">SNMP</h2>
      </Card.Header>
      <Card.Body>
        <dl className="wrap-anywhere grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
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
              <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono">{revealed?.snmpCommunity ?? creds.snmpCommunity ?? '—'}</dd>
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
                <dt className="font-medium text-gray-500 dark:text-gray-400">Clave auth</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono">{revealed?.snmpV3AuthKey ?? creds.snmpV3AuthKey ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Protocolo priv.</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">{creds.snmpV3PrivProto ?? '—'}</dd>
              </div>
              {creds.snmpV3PrivProto && (
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Clave priv.</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono">{revealed?.snmpV3PrivKey ?? creds.snmpV3PrivKey ?? '—'}</dd>
                </div>
              )}
            </>
          )}
        </dl>
      </Card.Body>
    </Card>
  
  );

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Eliminar credenciales"
        message="¿Eliminar las credenciales de este dispositivo? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        isLoading={deleting}
      />

      <Modal
        isOpen={showUnlock}
        onClose={() => setShowUnlock(false)}
        title="Confirma tu contraseña"
        info="Ver las credenciales en texto plano pide tu contraseña. Vale 5 minutos para cualquier dispositivo, y cada consulta queda registrada."
        size="sm"
        onSubmit={handleUnlock}
      >
        <Input
          label="Tu contraseña"
          type="password"
          value={unlockPassword}
          onChange={(e) => {
            setUnlockPassword(e.target.value);
            setUnlockError(null);
          }}
          error={unlockError ?? undefined}
          autoComplete="current-password"
          autoFocus
          fullWidth
        />
        <Modal.Footer>
          <Button variant="outline" onClick={() => setShowUnlock(false)} disabled={unlocking}>
            Cancelar
          </Button>
          <Button onClick={handleUnlock} isLoading={unlocking}>
            Ver credenciales
          </Button>
        </Modal.Footer>
      </Modal>

      {/* SNMP-first vendors read their summary before the HTTP card */}
      {snmpFirst && snmpSummary}

      <Card>
        <Card.Header>
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {snmpFirst ? 'Credenciales SNMP / HTTP' : 'Credenciales HTTP / API Web'}
            </h2>
            {!loading && (canManage || (canReveal && creds && !noCreds)) && (
              <div className="flex gap-2">
                {canReveal && creds && !noCreds && !showForm && (
                  <IconButton
                    icon={revealed ? <EyeOffIcon /> : <EyeIcon />}
                    label={revealed ? 'Ocultar credenciales' : 'Mostrar credenciales'}
                    onClick={handleRevealToggle}
                    isLoading={revealing}
                    data-testid="credentials-reveal"
                  />
                )}
                {canManage && (
                <EditToggleButton
                  isEditing={showForm}
                  onEdit={openForm}
                  onCancel={() => setShowForm(false)}
                  editLabel={noCreds ? 'Configurar' : 'Editar'}
                  data-testid="credentials-edit"
                />
                )}
                {canManage && !noCreds && !showForm && (
                  <IconButton
                    icon={<TrashIcon />}
                    label="Eliminar credenciales"
                    variant="danger"
                    onClick={() => setConfirmDelete(true)}
                    data-testid="credentials-delete"
                  />
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
              No hay credenciales configuradas para este dispositivo.{' '}
              {canManage
                ? 'Haga clic en "Configurar" para agregarlas.'
                : 'Solo un administrador puede configurarlas.'}
            </p>
          ) : creds && !showForm ? (
            <dl className="wrap-anywhere grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Estado HTTP</dt>
                <dd className="mt-1">
                  <Badge variant={creds.hasHttpCredentials ? 'success' : 'neutral'}>
                    {creds.hasHttpCredentials ? 'Configuradas' : 'Sin configurar'}
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
                  {revealed?.httpPassword ?? creds.httpPassword ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Puerto HTTP</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono">{creds.httpPort}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Puerto SSH</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono">{creds.sshPort}</dd>
              </div>
            </dl>
          ) : null}

          {revealed && revealedUntil && !showForm && (
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              Visibles hasta las{' '}
              {new Date(revealedUntil).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}.
            </p>
          )}

          {showForm && (
            <div className="space-y-6">
              {saveError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 text-sm text-red-800 dark:text-red-400">
                  {saveError}
                </div>
              )}

              {snmpFirst ? snmpSection : httpSection}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                {snmpFirst ? httpSection : snmpSection}
              </div>
            </div>
          )}

        </Card.Body>
        {showForm && (
          <Card.Footer>
            <EditFormActions
              onCancel={() => setShowForm(false)}
              onSave={handleSave}
              isSaving={saving}
              hideCancel
              saveLabel={noCreds ? 'Guardar' : 'Guardar Cambios'}
            />
          </Card.Footer>
        )}
      </Card>

      {!snmpFirst && snmpSummary}
    </div>
  );
}
