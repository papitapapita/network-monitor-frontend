export type AlertSeverity = 'WARNING' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'RESOLVED';

export interface AlertDTO {
  id: string;
  deviceId: string;
  severity: AlertSeverity;
  status: AlertStatus;
  startedAt: string;
  resolvedAt: string | null;
  notifiedAt: string | null;
  recoveryNotifiedAt: string | null;
  durationSecs: number | null;
}

export interface AlertListResponse {
  alerts: AlertDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

export interface ListAlertsQuery {
  deviceId?: string;
  limit?: number;
  offset?: number;
}
