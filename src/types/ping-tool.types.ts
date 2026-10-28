/**
 * A terminal-style ping of any IP address, from the server or from an agent
 * (MON-120 … MON-123), over `GET /api/network/ping/stream`. Nothing is stored:
 * no history, no device status, no alert.
 */

/** ERROR: the ping could not be sent at all — not a lost packet. */
export type PingToolOutcome = 'REPLY' | 'NO_REPLY' | 'ERROR';

export interface PingToolStartDTO {
  ipAddress: string;
  source: 'SERVER' | 'AGENT';
  agentId: string | null;
  agentName: string | null;
  count: number;
  startedAt: string;
}

export interface PingToolReplyDTO {
  /** 1-based. */
  seq: number;
  outcome: PingToolOutcome;
  /** REPLY only. */
  latencyMs: number | null;
  /** ERROR only, in English from the backend, e.g. "The agent is not connected". */
  detail: string | null;
  at: string;
}

export interface PingToolSummaryDTO {
  ipAddress: string;
  /** ERROR pings are not counted. */
  sent: number;
  received: number;
  errors: number;
  /** Null when nothing could be sent. */
  lossPercent: number | null;
  minMs: number | null;
  avgMs: number | null;
  maxMs: number | null;
  startedAt: string;
  finishedAt: string;
  /** Why an agent problem ended the run early. */
  stoppedEarly: string | null;
  /** Always false on the wire: a stopped run sends no summary. */
  cancelled: false;
}

export interface PingToolParams {
  ip: string;
  /** Omitted: the server pings. */
  agentId?: string;
  /** 1 – 100; the backend defaults to 4. */
  count?: number;
}
