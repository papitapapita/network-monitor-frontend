import type { DeviceCategory, DeviceStatus } from '@/types/device.types';

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
  field: 'macAddress' | 'ipAddress' | 'serialNumber' | 'locationId' | null;
  message: string;
};

/**
 * A device the network cannot reach is tracked by what is written on the box,
 * so the backend requires a serial number or a MAC for these two statuses —
 * on create and on update alike, whether or not an IP happens to be recorded.
 */
export const requiresIdentifier = (status: DeviceStatus | '' | null | undefined): boolean =>
  status === 'INVENTORY' || status === 'DAMAGED';

/** Shown under the serial-number input, the field the operator is likeliest to fill. */
export const MISSING_IDENTIFIER_MESSAGE = 'Se requiere número de serie o dirección MAC';

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

  return null;
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

export const DEVICE_OWNER_OPTIONS = [
  { value: '', label: 'Seleccionar tipo' },
  { value: 'COMPANY', label: 'Empresa' },
  { value: 'CLIENT', label: 'Cliente' },
];

export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  INVENTORY: 'Inventario',
  COMMISSIONING: 'Comisionamiento',
  ACTIVE: 'Activo',
  DAMAGED: 'Dañado',
};

export const DEVICE_STATUS_COLORS: Record<DeviceStatus, string> = {
  ACTIVE: '#10b981',
  COMMISSIONING: '#3b82f6',
  INVENTORY: '#6b7280',
  DAMAGED: '#ef4444',
};
