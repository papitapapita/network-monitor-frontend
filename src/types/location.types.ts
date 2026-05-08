export type LocationType =
  | 'TOWER'
  | 'NODE'
  | 'DATACENTER'
  | 'POP'
  | 'WAREHOUSE'
  | 'OFFICE';

export interface LocationResponseDTO {
  id: string;
  name: string;
  type: LocationType;
  municipality: string | null;
  neighborhood: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLocationDTO {
  name: string;
  type: LocationType;
  municipality?: string | null;
  neighborhood?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
}

export interface UpdateLocationDTO {
  name?: string;
  type?: LocationType;
  municipality?: string | null;
  neighborhood?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
}

export interface ListLocationsQuery {
  limit?: number;
  offset?: number;
  type?: LocationType;
}

export interface LocationListResponse {
  locations: LocationResponseDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
