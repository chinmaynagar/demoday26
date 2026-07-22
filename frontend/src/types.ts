export interface LeaderboardEntry {
  rank: number;
  demo_id: string;
  avg_score: number;
  total_score: number;
  unique_feedbacks: number;
  top_aspects: string[];
  bayesian_score: number;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  last_updated: string | null;
  total_submissions_raw: number;
  total_entries: number;
}

export interface StatsResponse {
  total_submissions: number;
  total_unique_projects: number;
  total_unique_voters: number;
  last_updated: string | null;
}

export interface SyncStatus {
  enabled: boolean;
  sheet_url_configured: boolean;
  last_synced_at: string | null;
  last_sync_ok: boolean;
  last_error: string | null;
  next_sync_in_seconds: number | null;
  interval_seconds: number;
}
