export interface BackendHealth {
  status: string;
  service: string;
  port: number;
}

export interface BackendJobSchedule {
  job_id: string;
  cron: string;
}

export interface BackendJobState {
  running: boolean;
  current_mode: "full_refresh" | "heat_refresh" | null;
  last_status: "idle" | "running" | "success" | "failed";
  last_started_at: string | null;
  last_finished_at: string | null;
  last_duration_seconds: number | null;
  last_message: string;
  log_tail: string[];
  schedule: BackendJobSchedule[];
}

export interface BackendHeatResponse {
  timestamp: string;
  cache_status?: "fresh" | "stale" | "empty";
  cache_age_seconds?: number | null;
  requested_count: number;
  refreshed_count: number;
  missing_codes: string[];
  stocks: Record<string, { d: number; d5: number; d20?: number }>;
}
