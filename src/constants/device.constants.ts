import type { DeviceCategory, DeviceStatus } from '@/types/device.types';

/** Categories that require a wireless-capable device model. */
export const WIRELESS_CATEGORIES: DeviceCategory[] = ['WIRELESS_CPE', 'AP'];

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

const DEVICE_CATEGORY_CORE = [
  { value: 'CPE', label: 'CPE (Cliente)' },
  { value: 'WIRELESS_CPE', label: 'CPE Inalámbrico' },
  { value: 'AP', label: 'Punto de Acceso (AP)' },
  { value: 'ROUTERBOARD', label: 'Routerboard' },
  { value: 'SMART_SWITCH', label: 'Switch Gestionable' },
  { value: 'SMART_SWITCH_POE', label: 'Switch Gestionable PoE' },
  { value: 'OTHER', label: 'Otro' },
];

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
