/**
 * The on-site server's own internet link, measured against Cloudflare
 * (MON-100 … MON-104), from `GET /api/network/speed-test/stream`. Unlike the
 * network sweep every finished or failed test is kept; a stopped one is not.
 */

export type SpeedTestPhase = 'LATENCY' | 'DOWNLOAD' | 'UPLOAD';

export interface SpeedTestStartDTO {
  startedAt: string;
  latencySamples: number;
  downloadSeconds: number;
  uploadSeconds: number;
}

export interface SpeedTestProgressDTO {
  phase: SpeedTestPhase;
  /** Since this phase began. */
  elapsedMs: number;
  /** DOWNLOAD/UPLOAD: the speed over the last second. */
  mbps: number | null;
  /** LATENCY: this sample. */
  latencyMs: number | null;
}

export interface SpeedTestResultDTO {
  id: string;
  status: 'COMPLETED' | 'FAILED';
  /** Null when the test failed before measuring it. */
  downloadMbps: number | null;
  uploadMbps: number | null;
  /** Median of the samples. */
  latencyMs: number | null;
  jitterMs: number | null;
  /** Cloudflare data center code, e.g. "BOG". */
  serverLocation: string | null;
  /** FAILED only, in English from the backend. */
  error: string | null;
  startedByEmail: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface SpeedTestListResponseDTO {
  results: SpeedTestResultDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
