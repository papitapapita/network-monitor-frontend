import type { DeviceStatus } from '@/types/device.types';

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
