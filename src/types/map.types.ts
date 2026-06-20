import { DeviceCategory, DeviceStatus } from './device.types';
import { LocationType } from './location.types';

export interface MapPinDevice {
  id: string;
  name: string;
  status: DeviceStatus;
  category: DeviceCategory | null;
  ipAddress: string | null;
  macAddress: string | null;
  monitoringEnabled: boolean;
}

export interface MapPin {
  id: string;
  name: string;
  locationType: LocationType;
  latitude: number;
  longitude: number;
  altitude: number | null;
  municipality: string | null;
  neighborhood: string | null;
  address: string | null;
  devices: MapPinDevice[];
}

export interface LocationMapResponse {
  total: number;
  pins: MapPin[];
}
