// ============================================================
// Domain model types for Amazon Competitor Radar
// ============================================================

// --- Competitor ---

export type CompetitorStatus = 'active' | 'paused' | 'error'

export interface Competitor {
  id: number
  asin: string
  marketplace: string
  url: string
  title: string | null
  image_url: string | null
  status: CompetitorStatus
  consecutive_failures: number
  created_at: string
  updated_at: string
}

export type NewCompetitor = Omit<Competitor, 'id' | 'created_at' | 'updated_at'>

// --- Snapshot ---

export type CaptureStatus = 'success' | 'failed'

export type CaptureErrorType =
  | 'PAGE_LOAD_FAILED'
  | 'PRODUCT_NOT_FOUND'
  | 'CAPTCHA_DETECTED'
  | 'REGION_BLOCKED'
  | 'PARSER_FAILED'
  | 'NETWORK_TIMEOUT'
  | 'UNKNOWN_ERROR'
  | null

export interface Snapshot {
  id: number
  competitor_id: number
  title: string | null
  price: number | null
  currency: string | null
  rating: number | null
  review_count: number | null
  availability: string | null
  image_url: string | null
  captured_at: string
  capture_status: CaptureStatus
  error_type: CaptureErrorType
  error_message: string | null
}

export type NewSnapshot = Omit<Snapshot, 'id'>

// --- Monitor Job ---

export interface MonitorJob {
  id: number
  competitor_id: number
  interval_minutes: number
  next_run_at: string | null
  enabled: number // SQLite boolean
  created_at: string
  updated_at: string
}

export type NewMonitorJob = Omit<MonitorJob, 'id' | 'created_at' | 'updated_at'>

// --- Alert ---

export type AlertType = 'price_change' | 'rating_drop' | 'review_growth' | 'availability_change'

export interface Alert {
  id: number
  competitor_id: number
  snapshot_id: number | null
  previous_snapshot_id: number | null
  alert_type: AlertType
  title: string
  message: string
  is_read: number // SQLite boolean
  created_at: string
}

export type NewAlert = Omit<Alert, 'id' | 'created_at'>

// --- Settings ---

export interface Setting {
  key: string
  value: string
  updated_at: string
}

// --- Dashboard summary ---

export interface CompetitorSummary {
  competitor: Competitor
  latest_snapshot: Snapshot | null
  snapshot_count: number
  last_captured_at: string | null
}
