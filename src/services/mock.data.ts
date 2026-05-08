import {
  DeviceResponseDTO,
  LocationResponseDTO,
  DeviceModelResponseDTO,
  PollingStatusDTO,
  PollingResultDTO,
} from '../types/device.types';

const now = new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const minsAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

export const MOCK_DEVICE_MODELS: DeviceModelResponseDTO[] = [
  { id: 'dm-1', vendorId: 'v-1', vendorName: 'MikroTik', vendorSlug: 'mikrotik', model: 'RB750Gr3', deviceType: 'ROUTER', createdAt: daysAgo(90), updatedAt: daysAgo(90) },
  { id: 'dm-2', vendorId: 'v-2', vendorName: 'Ubiquiti', vendorSlug: 'ubiquiti', model: 'UniFi AP-AC-Pro', deviceType: 'ANTENNA', createdAt: daysAgo(90), updatedAt: daysAgo(90) },
  { id: 'dm-3', vendorId: 'v-1', vendorName: 'MikroTik', vendorSlug: 'mikrotik', model: 'CRS326-24G-2S+RM', deviceType: 'SWITCH', createdAt: daysAgo(90), updatedAt: daysAgo(90) },
  { id: 'dm-4', vendorId: 'v-3', vendorName: 'Mimosa', vendorSlug: 'mimosa', model: 'B5c', deviceType: 'RADIO', createdAt: daysAgo(90), updatedAt: daysAgo(90) },
  { id: 'dm-5', vendorId: 'v-4', vendorName: 'TP-Link', vendorSlug: 'tp-link', model: 'TL-SG1024DE', deviceType: 'SWITCH', createdAt: daysAgo(90), updatedAt: daysAgo(90) },
  { id: 'dm-6', vendorId: 'v-2', vendorName: 'Ubiquiti', vendorSlug: 'ubiquiti', model: 'EdgeRouter X', deviceType: 'ROUTERBOARD', createdAt: daysAgo(90), updatedAt: daysAgo(90) },
];

export const MOCK_LOCATIONS: LocationResponseDTO[] = [
  {
    id: 'loc-1', name: 'Main Tower', type: 'TOWER',
    municipality: 'Downtown', neighborhood: 'Centro', address: 'Av. Principal 100',
    latitude: -23.5505, longitude: -46.6333, altitude: 42,
    createdAt: daysAgo(60), updatedAt: daysAgo(60),
  },
  {
    id: 'loc-2', name: 'City Office', type: 'OFFICE',
    municipality: 'Midtown', neighborhood: 'Vila Nova', address: 'Rua das Flores 55',
    latitude: -23.5605, longitude: -46.6500, altitude: 10,
    createdAt: daysAgo(60), updatedAt: daysAgo(30),
  },
  {
    id: 'loc-3', name: 'Primary Datacenter', type: 'DATACENTER',
    municipality: 'Downtown', neighborhood: null, address: 'Rua dos Servidores 8',
    latitude: -23.5490, longitude: -46.6280, altitude: 5,
    createdAt: daysAgo(60), updatedAt: daysAgo(60),
  },
  {
    id: 'loc-4', name: 'East Distribution Node', type: 'NODE',
    municipality: 'East Side', neighborhood: 'Jardim Leste', address: null,
    latitude: -23.5450, longitude: -46.5900, altitude: 18,
    createdAt: daysAgo(45), updatedAt: daysAgo(45),
  },
  {
    id: 'loc-5', name: 'Warehouse A', type: 'WAREHOUSE',
    municipality: 'Industrial Zone', neighborhood: null, address: 'Rua Industrial 200',
    latitude: null, longitude: null, altitude: null,
    createdAt: daysAgo(45), updatedAt: daysAgo(45),
  },
];

export const MOCK_DEVICES: DeviceResponseDTO[] = [
  {
    id: 'dev-1', name: 'Core-Router-01', status: 'ACTIVE', category: 'CORE',
    ownerType: 'COMPANY', deviceModelId: 'dm-1', locationId: 'loc-1',
    ipAddress: '10.0.0.1', macAddress: 'AA:BB:CC:DD:EE:01', serialNumber: 'MT-001',
    monitoringEnabled: true, description: 'Primary edge router',
    installedDate: daysAgo(180), createdAt: daysAgo(180), updatedAt: daysAgo(2),
  },
  {
    id: 'dev-2', name: 'AP-Floor-2-01', status: 'ACTIVE', category: 'ACCESS_POINT',
    ownerType: 'COMPANY', deviceModelId: 'dm-2', locationId: 'loc-2',
    ipAddress: '10.0.1.10', macAddress: 'AA:BB:CC:DD:EE:02', serialNumber: null,
    monitoringEnabled: true, description: null,
    installedDate: daysAgo(120), createdAt: daysAgo(120), updatedAt: daysAgo(5),
  },
  {
    id: 'dev-3', name: 'Switch-Core-01', status: 'ACTIVE', category: 'DISTRIBUTION',
    ownerType: 'COMPANY', deviceModelId: 'dm-3', locationId: 'loc-1',
    ipAddress: '10.0.0.2', macAddress: 'AA:BB:CC:DD:EE:03', serialNumber: 'MT-CRS-001',
    monitoringEnabled: true, description: 'Core distribution switch',
    installedDate: daysAgo(180), createdAt: daysAgo(180), updatedAt: daysAgo(1),
  },
  {
    id: 'dev-4', name: 'Radio-Link-East', status: 'ACTIVE', category: 'DISTRIBUTION',
    ownerType: 'COMPANY', deviceModelId: 'dm-4', locationId: 'loc-4',
    ipAddress: '192.168.50.1', macAddress: 'AA:BB:CC:DD:EE:04', serialNumber: 'MIM-004',
    monitoringEnabled: true, description: 'Backhaul link to east node',
    installedDate: daysAgo(90), createdAt: daysAgo(90), updatedAt: daysAgo(3),
  },
  {
    id: 'dev-5', name: 'Switch-Floor-1', status: 'ACTIVE', category: 'POE',
    ownerType: 'COMPANY', deviceModelId: 'dm-5', locationId: 'loc-2',
    ipAddress: '10.0.1.2', macAddress: 'AA:BB:CC:DD:EE:05', serialNumber: null,
    monitoringEnabled: false, description: null,
    installedDate: daysAgo(120), createdAt: daysAgo(120), updatedAt: daysAgo(10),
  },
  {
    id: 'dev-6', name: 'CPE-Client-Souza', status: 'ACTIVE', category: 'CLIENT_CPE',
    ownerType: 'CLIENT', deviceModelId: 'dm-6', locationId: null,
    ipAddress: '192.168.100.1', macAddress: 'AA:BB:CC:DD:EE:06', serialNumber: null,
    monitoringEnabled: true, description: 'Residential client',
    installedDate: daysAgo(30), createdAt: daysAgo(30), updatedAt: daysAgo(0),
  },
  {
    id: 'dev-7', name: 'Core-Router-02', status: 'MAINTENANCE', category: 'CORE',
    ownerType: 'COMPANY', deviceModelId: 'dm-1', locationId: 'loc-3',
    ipAddress: '10.0.0.3', macAddress: 'AA:BB:CC:DD:EE:07', serialNumber: 'MT-002',
    monitoringEnabled: false, description: 'Under firmware upgrade',
    installedDate: daysAgo(180), createdAt: daysAgo(180), updatedAt: daysAgo(1),
  },
  {
    id: 'dev-8', name: 'AP-Roof-01', status: 'DAMAGED', category: 'ACCESS_POINT',
    ownerType: 'COMPANY', deviceModelId: 'dm-2', locationId: 'loc-1',
    ipAddress: null, macAddress: 'AA:BB:CC:DD:EE:08', serialNumber: null,
    monitoringEnabled: false, description: 'Lightning damage — awaiting replacement',
    installedDate: daysAgo(200), createdAt: daysAgo(200), updatedAt: daysAgo(7),
  },
  {
    id: 'dev-9', name: 'Switch-Spare-01', status: 'INVENTORY', category: null,
    ownerType: 'COMPANY', deviceModelId: 'dm-5', locationId: 'loc-5',
    ipAddress: null, macAddress: null, serialNumber: null,
    monitoringEnabled: false, description: 'Spare unit in warehouse',
    installedDate: null, createdAt: daysAgo(14), updatedAt: daysAgo(14),
  },
  {
    id: 'dev-10', name: 'Router-Legacy-01', status: 'DECOMMISSIONED', category: 'CORE',
    ownerType: 'COMPANY', deviceModelId: 'dm-6', locationId: null,
    ipAddress: null, macAddress: 'AA:BB:CC:DD:EE:10', serialNumber: 'UBI-OLD-001',
    monitoringEnabled: false, description: 'Replaced by Core-Router-01',
    installedDate: daysAgo(400), createdAt: daysAgo(400), updatedAt: daysAgo(60),
  },
];

function lastResult(deviceId: string, status: 'SUCCESS' | 'FAILED', deviceStatus: 'ONLINE' | 'OFFLINE', latencyMs?: number): PollingResultDTO {
  return {
    id: `poll-seed-${deviceId}`,
    deviceId,
    timestamp: minsAgo(1),
    status,
    metrics: latencyMs ? { latencyMs } : null,
    deviceStatus,
  };
}

// Polling status per device (only for monitoring-enabled ones)
export const MOCK_POLLING_STATUS: Record<string, PollingStatusDTO> = {
  'dev-1': {
    deviceId: 'dev-1', pollingEnabled: true, intervalSeconds: 60, failuresBeforeDown: 3,
    lastPolled: minsAgo(1), nextScheduled: new Date(Date.now() + 59_000).toISOString(),
    currentStatus: 'ONLINE', lastResult: lastResult('dev-1', 'SUCCESS', 'ONLINE', 12), consecutiveFailures: 0,
  },
  'dev-2': {
    deviceId: 'dev-2', pollingEnabled: true, intervalSeconds: 60, failuresBeforeDown: 3,
    lastPolled: minsAgo(2), nextScheduled: new Date(Date.now() + 58_000).toISOString(),
    currentStatus: 'ONLINE', lastResult: lastResult('dev-2', 'SUCCESS', 'ONLINE', 18), consecutiveFailures: 0,
  },
  'dev-3': {
    deviceId: 'dev-3', pollingEnabled: true, intervalSeconds: 30, failuresBeforeDown: 5,
    lastPolled: minsAgo(1), nextScheduled: new Date(Date.now() + 29_000).toISOString(),
    currentStatus: 'ONLINE', lastResult: lastResult('dev-3', 'SUCCESS', 'ONLINE', 8), consecutiveFailures: 0,
  },
  'dev-4': {
    deviceId: 'dev-4', pollingEnabled: true, intervalSeconds: 120, failuresBeforeDown: 3,
    lastPolled: minsAgo(5), nextScheduled: new Date(Date.now() + 115_000).toISOString(),
    currentStatus: 'OFFLINE', lastResult: lastResult('dev-4', 'FAILED', 'OFFLINE'), consecutiveFailures: 4,
  },
  'dev-6': {
    deviceId: 'dev-6', pollingEnabled: true, intervalSeconds: 300, failuresBeforeDown: 2,
    lastPolled: minsAgo(3), nextScheduled: new Date(Date.now() + 297_000).toISOString(),
    currentStatus: 'ONLINE', lastResult: lastResult('dev-6', 'SUCCESS', 'ONLINE', 35), consecutiveFailures: 0,
  },
};

// Build polling history entries
function buildHistory(deviceId: string, successRate: number, count = 20): PollingResultDTO[] {
  return Array.from({ length: count }, (_, i) => {
    const success = Math.random() < successRate;
    return {
      id: `poll-${deviceId}-${i}`,
      deviceId,
      timestamp: new Date(Date.now() - i * 65_000).toISOString(),
      status: (success ? 'SUCCESS' : 'FAILED') as 'SUCCESS' | 'FAILED',
      metrics: success ? { latencyMs: 8 + Math.floor(Math.random() * 40) } : null,
      deviceStatus: (success ? 'ONLINE' : 'OFFLINE') as 'ONLINE' | 'OFFLINE' | 'UNKNOWN',
    };
  });
}

export const MOCK_POLLING_HISTORY: Record<string, PollingResultDTO[]> = {
  'dev-1': buildHistory('dev-1', 0.98),
  'dev-2': buildHistory('dev-2', 0.95),
  'dev-3': buildHistory('dev-3', 0.99),
  'dev-4': buildHistory('dev-4', 0.40),
  'dev-6': buildHistory('dev-6', 0.90),
};

export { now };
