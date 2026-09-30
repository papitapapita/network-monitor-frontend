/**
 * On-site probe agents — a program installed on a PC inside a customer's
 * network that measures it from there and reports to the backend (ADR 0002).
 */

export type AgentStatus = 'PENDING' | 'ACTIVE' | 'REVOKED';

export interface AgentDTO {
  id: string;
  /** Unique across all agents, revoked included; 1–60 chars. */
  name: string;
  status: AgentStatus;
  /** Set only while PENDING — the pairing key stops working at this instant. */
  pairingExpiresAt: string | null;
  enrolledAt: string | null;
  revokedAt: string | null;
  /** Refreshed on connect and every 30 s while connected; null until the first connection. */
  lastSeenAt: string | null;
  agentVersion: string | null;
  clockOffsetMs: number | null;
  /** Set only while ACTIVE and silent for 5 minutes — this *is* the offline badge. */
  offlineSince: string | null;
  /** Set while the PC's clock is more than a minute off. Results are already corrected. */
  clockDriftSince: string | null;
  /** Live devices behind it; the recycle bin is not counted (AGT-010). */
  deviceCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Returned by create and re-key: the only time the pairing key is ever shown. */
export interface AgentPairingDTO {
  agent: AgentDTO;
  pairingKey: string;
}

export interface AgentListResponse {
  agents: AgentDTO[];
}

export interface CreateAgentDTO {
  name: string;
}

/**
 * `agentId` plus exactly one selector. `null` stands for the server itself,
 * on either side: `agentId: null` sends devices back to server polling, and
 * `fromAgentId: null` picks every device the server polls today.
 */
export type AgentAssignmentDTO =
  | { agentId: string | null; deviceIds: string[] }
  | { agentId: string | null; fromAgentId: string | null };

/** Each device is moved on its own; a device that breaks a rule stays put and is listed here. */
export interface AgentAssignmentResultDTO {
  assigned: string[];
  failed: { id: string; error: string }[];
}

export type AgentOutageEndReason = 'RECONNECTED' | 'REVOKED';

/** One time the agent went offline (AGT-026). Recorded since 2026-09-29. */
export interface AgentOutageDTO {
  id: string;
  /** Its last contact before the silence — when the outage really began. */
  silentSince: string;
  /** When it was marked offline, about 5 minutes later. */
  offlineSince: string;
  /** null while it is still offline — that entry matches the agent's `offlineSince`. */
  endedAt: string | null;
  endReason: AgentOutageEndReason | null;
}

export interface AgentOutageListResponse {
  outages: AgentOutageDTO[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
