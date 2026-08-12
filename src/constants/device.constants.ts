import type {
  DeviceCategory,
  DeviceOwnerType,
  DeviceStatus,
  RetiredDeviceStatus,
} from '@/types/device.types';

/**
 * Categories that require a wireless-capable device model. These are also the
 * only two the backend lets hold a wireless config — it derives the radio mode
 * from them (WIRELESS_CPE → STATION, ACCESS_POINT → ACCESS_POINT).
 */
export const WIRELESS_CATEGORIES: DeviceCategory[] = ['WIRELESS_CPE', 'ACCESS_POINT'];

export const isWirelessCategory = (category: DeviceCategory | '' | null | undefined): boolean =>
  !!category && WIRELESS_CATEGORIES.includes(category as DeviceCategory);

const IPV4_OCTET = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4_REGEX = new RegExp(`^${IPV4_OCTET}(\\.${IPV4_OCTET}){3}$`);

// Accepts full and compressed ("::") forms; does not validate zone IDs or embedded IPv4.
const IPV6_REGEX = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;

export const isValidIpAddress = (value: string): boolean => {
  const v = value.trim();
  return IPV4_REGEX.test(v) || IPV6_REGEX.test(v);
};

const MAC_REGEX = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$|^([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}$/;

export const isValidMacAddress = (value: string): boolean => MAC_REGEX.test(value.trim());

/** Strips separators and cases the digits so `aa-bb-…` and `AA:BB:…` compare equal. */
export const normalizeMacAddress = (value: string): string =>
  value.replace(/[:\-.]/g, '').toUpperCase();

/**
 * A MAC address belongs to at most one device, and so does an IP. The backend
 * enforces both and answers in English, so restate the fact in the UI language
 * and name the field it belongs to, so a form can mark the offending input.
 */
export type DeviceConflict = {
  field: 'macAddress' | 'ipAddress' | 'serialNumber' | 'locationId' | 'deviceModelId' | 'category' | null;
  message: string;
};

/**
 * The statuses a unit that is off the network can hold: back in stock, broken
 * but still ours, or retired for good. None of them polls, and each is a legal
 * destination for the outgoing unit of a hardware replacement.
 */
export const RETIRED_STATUSES: RetiredDeviceStatus[] = [
  'INVENTORY',
  'DAMAGED',
  'DECOMMISSIONED',
];

/**
 * A device the network cannot reach is tracked by what is written on the box,
 * so the backend requires a serial number or a MAC for every retired status —
 * on create and on update alike, whether or not an IP happens to be recorded.
 */
export const requiresIdentifier = (status: DeviceStatus | '' | null | undefined): boolean =>
  !!status && (RETIRED_STATUSES as string[]).includes(status);

/** Shown under the serial-number input, the field the operator is likeliest to fill. */
export const MISSING_IDENTIFIER_MESSAGE = 'Se requiere número de serie o dirección MAC';

/**
 * "Monitoring can only be enabled for ACTIVE or COMMISSIONING devices" — and on
 * the way into either of the other two the backend disables the polling config
 * by itself, so monitoring cannot be held on there either.
 */
const MONITORABLE_STATUSES: DeviceStatus[] = ['ACTIVE', 'COMMISSIONING'];

/**
 * Polling pings the device's IP, so it needs one, and the backend refuses it for
 * a device that is not on the network — offering to turn monitoring on in those
 * cases only sets up a write that is rejected or immediately undone.
 */
export const canEnableMonitoring = (
  status: DeviceStatus | '' | null | undefined,
  ipAddress: string | null | undefined
): boolean =>
  !!ipAddress?.trim() && MONITORABLE_STATUSES.includes(status as DeviceStatus);

/** Why monitoring cannot be turned on, phrased for the operator — null when it can. */
export function monitoringBlockedReason(
  status: DeviceStatus | '' | null | undefined,
  ipAddress: string | null | undefined
): string | null {
  if (!ipAddress?.trim()) {
    return 'Este dispositivo no tiene dirección IP. Asigne una en la pestaña «Detalles» para habilitar el monitoreo.';
  }
  if (!MONITORABLE_STATUSES.includes(status as DeviceStatus)) {
    const label = DEVICE_STATUS_LABELS[status as DeviceStatus] ?? status;
    return `El monitoreo solo puede habilitarse en dispositivos activos o en comisionamiento; este está en «${label}». Cambie el estado en la pestaña «Detalles» para habilitarlo.`;
  }
  return null;
}

/** The same rule stated after the fact, once a status is known — for a rejected write. */
export const missingIdentifierError = (status: DeviceStatus): DeviceConflict => ({
  field: 'serialNumber',
  message: `Un dispositivo en estado «${DEVICE_STATUS_LABELS[status] ?? status}» debe tener al menos un número de serie o una dirección MAC`,
});

export const duplicateMacError = (mac: string): DeviceConflict => ({
  field: 'macAddress',
  message: `La dirección MAC "${mac}" ya está asignada a otro dispositivo`,
});

export const duplicateIpError = (ip: string): DeviceConflict => ({
  field: 'ipAddress',
  message: `La dirección IP "${ip}" ya está asignada a otro dispositivo`,
});

/** Returns null for anything that isn't one of these conflicts, so callers keep the original error. */
export function translateDeviceConflict(error: string): DeviceConflict | null {
  const mac = error.match(/^MAC address "(.+)" is already assigned to another device$/);
  if (mac) return duplicateMacError(mac[1]);

  const ip = error.match(/^IP address "(.+)" is already assigned to another device$/);
  if (ip) return duplicateIpError(ip[1]);

  // The unique-constraint fallback the backend returns when a concurrent insert
  // won the race — it doesn't say which of the two columns collided.
  if (error === 'A device with this MAC address or IP address already exists') {
    return { field: null, message: 'Ya existe un dispositivo con esta dirección MAC o dirección IP' };
  }

  return null;
}

/** Shown wherever the category is offered for editing, not only after a refusal. */
export const CATEGORY_LOCKED_MESSAGE =
  'La categoría decide el modo de radio de la configuración inalámbrica, así que no puede cambiarse mientras esa configuración exista. Elimínela en la pestaña «Inalámbrico» y vuelva a crearla después de recategorizar.';

/**
 * The status invariants the backend checks on create and update. Every form
 * here checks them first, so these only surface when the device changed under
 * the operator or a form let something through — either way the answer arrives
 * in English, so restate it in the UI language and name the input that fixes it.
 * Returns null for anything else, so callers keep the original error.
 */
export function translateDeviceInvariant(error: string): DeviceConflict | null {
  const identifier = error.match(
    /^A device with status (\w+) must have at least a serial number or MAC address$/
  );
  if (identifier) return missingIdentifierError(identifier[1] as DeviceStatus);

  const missingIp = error.match(/^An? (ACTIVE|COMMISSIONING) device must have an IP address assigned$/);
  if (missingIp) {
    const status = DEVICE_STATUS_LABELS[missingIp[1] as DeviceStatus] ?? missingIp[1];
    return {
      field: 'ipAddress',
      message: `Un dispositivo en estado «${status}» debe tener una dirección IP asignada`,
    };
  }

  if (error === 'An ACTIVE device must have a location assigned') {
    return {
      field: 'locationId',
      message: 'Un dispositivo activo debe tener una ubicación asignada',
    };
  }

  if (error === 'Monitoring can only be enabled for ACTIVE or COMMISSIONING devices') {
    return {
      field: null,
      message: 'El monitoreo solo puede habilitarse en dispositivos activos o en comisionamiento',
    };
  }

  // Correcting a mis-registered model is only allowed while nothing has been
  // polled yet, so the reading history cannot end up on the wrong hardware.
  const modelLocked = error.match(
    /^Cannot change the device model of a device with status (\w+)/
  );
  if (modelLocked) {
    const status = DEVICE_STATUS_LABELS[modelLocked[1] as DeviceStatus] ?? modelLocked[1];
    return {
      field: 'deviceModelId',
      message: `El modelo solo puede corregirse mientras el dispositivo está en inventario; este está en «${status}»`,
    };
  }

  const modelMissing = error.match(/^Device model not found: /);
  if (modelMissing) {
    return { field: 'deviceModelId', message: 'El modelo seleccionado ya no existe' };
  }

  // The wireless config's radio mode was derived from the category when it was
  // created, so the category is frozen for as long as that config exists.
  if (error.startsWith('Cannot change the category of a device that has a wireless config')) {
    return { field: 'category', message: CATEGORY_LOCKED_MESSAGE };
  }

  return null;
}

/**
 * Deleting a device is refused while something downstream still points at it.
 * Neither refusal is fixable from the delete dialog — the operator has to go
 * cancel the service or close the tickets — so the blocker is named separately
 * from the message, letting the caller offer the link that gets them there.
 */
export type DeviceDeleteBlocker = {
  blocker: 'contractedService' | 'openTickets';
  message: string;
};

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspendido',
  CANCELLED: 'Cancelado',
};

/** Returns null for anything else, so callers keep the original error. */
export function translateDeviceDeleteBlocker(error: string): DeviceDeleteBlocker | null {
  const service = error.match(
    /^Cannot delete a device with a live contracted service \(status (\w+)\)\. Cancel the service first\.$/
  );
  if (service) {
    const status = CONTRACT_STATUS_LABELS[service[1]] ?? service[1];
    return {
      blocker: 'contractedService',
      message: `Este dispositivo tiene un servicio contratado vigente (estado «${status}»). Cancele el servicio antes de eliminarlo.`,
    };
  }

  const tickets = error.match(
    /^Cannot delete a device with (\d+) open ticket\(s\)\. Resolve or cancel them first\.$/
  );
  if (tickets) {
    const count = Number(tickets[1]);
    return {
      blocker: 'openTickets',
      message: `Este dispositivo tiene ${count} ${count === 1 ? 'ticket abierto' : 'tickets abiertos'}. Resuélvalos o cancélelos antes de eliminarlo.`,
    };
  }

  return null;
}

/** How long a deleted device can still be brought back. */
export const RESTORE_GRACE_DAYS = 7;

/**
 * A restored device comes back with monitoring off whatever it had before, and
 * a retired status is not undone either — so say what is still missing instead
 * of letting the operator find it later on a grey status pill.
 */
export const RESTORE_SUCCESS_MESSAGE =
  'Dispositivo restaurado con el monitoreo deshabilitado. Vuelva a habilitarlo — y a cambiar el estado si el dispositivo estaba retirado — para ponerlo en servicio.';

/**
 * The restore and purge refusals. Both are `400`s about the state of the
 * tombstone rather than about anything the operator typed, so neither belongs
 * on a form field.
 */
export function translateDeviceBinError(error: string): string | null {
  if (error === 'Cannot restore a device whose 7-day grace period expired') {
    return `El plazo de ${RESTORE_GRACE_DAYS} días para restaurar este dispositivo ya venció; no se puede recuperar.`;
  }
  if (error === 'Cannot restore a device that is not deleted') {
    return 'Este dispositivo no está eliminado, así que no hay nada que restaurar.';
  }
  if (
    error ===
    'Cannot permanently delete a device that is not in the recycle bin. Delete it first.'
  ) {
    return 'Este dispositivo no está en la papelera. Elimínelo primero para poder borrarlo de forma permanente.';
  }
  return null;
}

/**
 * The replacement's own refusals. A device is one physical box, so the new unit
 * needs its own identifier and the outgoing one can only be swapped once.
 */
export function translateDeviceReplaceError(error: string): DeviceConflict | null {
  if (error === 'The replacement device must have at least a serial number or MAC address') {
    return { field: 'serialNumber', message: MISSING_IDENTIFIER_MESSAGE };
  }
  if (error === 'Device has already been replaced') {
    return {
      field: null,
      message:
        'Este dispositivo ya fue reemplazado. Para registrar otro cambio de equipo, reemplace la unidad actual.',
    };
  }
  return translateDeviceConflict(error) ?? translateDeviceInvariant(error);
}

/**
 * DEV-026: a device model can't be deleted while devices still point at it.
 * Shared by the real translator and the mock so both say the same thing.
 */
export function liveDeviceModelMessage(count: number): string {
  const noun = count === 1 ? 'dispositivo asociado' : 'dispositivos asociados';
  const tail = count === 1
    ? 'Reasigna o elimina ese dispositivo primero.'
    : 'Reasigna o elimina esos dispositivos primero.';
  return `No se puede eliminar el modelo: tiene ${count} ${noun}. ${tail}`;
}

/**
 * DEV-030: DEV-026 only counts live devices, so a model whose last units are
 * soft-deleted (DEV-070) reads as unused even though the tombstones still
 * hold the foreign key. Named here rather than left to a raw DB error, and
 * gated behind a confirmation since retrying with `purgeBinnedDevices` burns
 * those devices' 7-day restore window for good.
 */
export function binnedDeviceModelMessage(count: number): string {
  const noun = count === 1 ? 'dispositivo' : 'dispositivos';
  const verb = count === 1 ? 'se eliminará' : 'se eliminarán';
  return `Este modelo tiene ${count} ${noun} en la papelera. Si confirmas, ${verb} de forma permanente junto con el modelo.`;
}

// The category says what role the unit plays in the network. Hardware traits
// (PoE, port count, …) belong to the device model's deviceType, never here.
const DEVICE_CATEGORY_CORE: { value: DeviceCategory; label: string }[] = [
  { value: 'CPE', label: 'CPE (Cliente)' },
  { value: 'WIRELESS_CPE', label: 'CPE Inalámbrico' },
  { value: 'ACCESS_POINT', label: 'Punto de Acceso' },
  { value: 'GATEWAY', label: 'Gateway (Salida a Internet)' },
  { value: 'AGGREGATION_SWITCH', label: 'Switch de Agregación' },
  { value: 'OTHER', label: 'Otro' },
];

export const DEVICE_CATEGORY_LABELS = Object.fromEntries(
  DEVICE_CATEGORY_CORE.map(({ value, label }) => [value, label])
) as Record<DeviceCategory, string>;

/** Falls back to the raw literal so a category we don't know yet still renders. */
export const deviceCategoryLabel = (category: DeviceCategory | null | undefined): string =>
  category ? DEVICE_CATEGORY_LABELS[category] ?? category.replace(/_/g, ' ') : '—';

export const DEVICE_CATEGORY_OPTIONS = [
  { value: '', label: 'Ninguna' },
  ...DEVICE_CATEGORY_CORE,
];

export const DEVICE_CATEGORY_FILTER_OPTIONS = [
  { value: '', label: 'Todas las Categorías' },
  ...DEVICE_CATEGORY_CORE,
];

const DEVICE_STATUS_CORE = [
  { value: 'INVENTORY', label: 'Inventario' },
  { value: 'COMMISSIONING', label: 'Comisionamiento' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'DAMAGED', label: 'Dañado' },
  { value: 'DECOMMISSIONED', label: 'Dado de baja' },
];

export const DEVICE_STATUS_OPTIONS = DEVICE_STATUS_CORE;

export const DEVICE_STATUS_CREATE_OPTIONS = [
  { value: '', label: 'Por defecto (Inventario)' },
  ...DEVICE_STATUS_CORE,
];

export const DEVICE_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Todos los Estados' },
  ...DEVICE_STATUS_CORE,
];

export const DEVICE_OWNER_LABELS: Record<DeviceOwnerType, string> = {
  COMPANY: 'Empresa',
  CLIENT: 'Cliente',
};

/** An owner is optional, so no owner reads as absent rather than as one of the two. */
export const deviceOwnerLabel = (ownerType: DeviceOwnerType | null | undefined): string =>
  ownerType ? DEVICE_OWNER_LABELS[ownerType] ?? ownerType : '—';

export const DEVICE_OWNER_OPTIONS = [
  { value: '', label: 'Seleccionar tipo' },
  ...(Object.entries(DEVICE_OWNER_LABELS) as [DeviceOwnerType, string][]).map(([value, label]) => ({
    value,
    label,
  })),
];

export const DEVICE_STATUS_LABELS = Object.fromEntries(
  DEVICE_STATUS_CORE.map(({ value, label }) => [value, label])
) as Record<DeviceStatus, string>;

/** Falls back to the raw literal so a status we don't know yet still renders. */
export const deviceStatusLabel = (status: DeviceStatus | '' | null | undefined): string =>
  status ? DEVICE_STATUS_LABELS[status] ?? status : '—';

/**
 * The three retired statuses offered as the destination for the unit coming out
 * of a hardware swap. Ordered by how a replacement usually ends: an upgraded
 * antenna that still works goes back in stock, a failed one is broken, an
 * obsolete one is done for good.
 */
export const RETIRED_STATUS_OPTIONS = RETIRED_STATUSES.map((value) => ({
  value,
  label: DEVICE_STATUS_LABELS[value],
}));

export const DEVICE_STATUS_COLORS: Record<DeviceStatus, string> = {
  ACTIVE: '#10b981',
  COMMISSIONING: '#3b82f6',
  INVENTORY: '#6b7280',
  DAMAGED: '#ef4444',
  // Retired for good: off the network like INVENTORY, but not coming back — so
  // distinct from it without borrowing DAMAGED's alarm.
  DECOMMISSIONED: '#a16207',
};
