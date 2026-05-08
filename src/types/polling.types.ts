export type PollingStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export interface PollingMetrics {
  latencyMs: number;
}

export interface PollingResultDTO {
  id: string;
  deviceId: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILED';
  metrics: PollingMetrics | null;
  deviceStatus: PollingStatus;
}

export interface PollingStatusDTO {
  deviceId: string;
  pollingEnabled: boolean;
  intervalSeconds: number;
  failuresBeforeDown: number;
  lastPolled: string | null;
  nextScheduled: string | null;
  currentStatus: PollingStatus;
  lastResult: PollingResultDTO | null;
  consecutiveFailures: number;
}

export interface PollingHistoryStats {
  successRate: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  uptimePercentage: number;
}

export interface PollingHistoryResponse {
  deviceId: string;
  results: PollingResultDTO[];
  totalCount: number;
  statistics: PollingHistoryStats;
}

export interface PollingHistoryQuery {
  fromDate?: string;
  toDate?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface CreatePollingConfigDTO {
  ipAddress?: string | null;
  intervalSeconds?: number;
  failuresBeforeDown?: number;
  enabled?: boolean;
}

export interface PollingConfigDTO {
  id: string;
  deviceId: string;
  ipAddress: string | null;
  intervalSeconds: number;
  failuresBeforeDown: number;
  enabled: boolean;
}

export interface UpdatePollingConfigDTO {
  intervalSeconds?: number;
  failuresBeforeDown?: number;
  enabled?: boolean;
}

export interface ManualPollResultDTO {
  deviceId: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  message: string;
  timestamp: string;
  metrics: PollingMetrics | null;
  deviceStatus: PollingStatus;
}
