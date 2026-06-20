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
  | 'DELIVERY_LOCATION_FAILED'
  | 'PARSER_FAILED'
  | 'NETWORK_TIMEOUT'
  | 'UNKNOWN_ERROR'
  | 'HTTP_429'
  | 'HTTP_503'
  | 'PAGE_BUDGET_EXHAUSTED'
  | 'MARKETPLACE_COOLDOWN'
  | null

export interface Snapshot {
  id: number
  competitor_id: number
  title: string | null
  price: number | null
  currency: string | null
  price_type: string | null
  regular_price: number | null
  list_price: number | null
  delivery_location: string | null
  rating: number | null
  review_count: number | null
  availability: string | null
  image_url: string | null
  captured_at: string
  capture_status: CaptureStatus
  error_type: CaptureErrorType
  error_message: string | null
}

export type NewSnapshot = Omit<
  Snapshot,
  'id' | 'price_type' | 'regular_price' | 'list_price' | 'delivery_location'
> &
  Partial<Pick<Snapshot, 'price_type' | 'regular_price' | 'list_price' | 'delivery_location'>>

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

export type SellerStoreStatus = 'active' | 'paused' | 'error'
export type StoreCaptureStatus = 'success' | 'failed' | 'partial'
export type StoreEventType =
  | 'new_visible'
  | 'suspected_missing'
  | 'restored'
  | 'price_changed'
  | 'promotion_changed'
  | 'availability_changed'

export interface SellerStore {
  id: number
  seller_id: string
  marketplace: string
  profile_url: string
  storefront_url: string
  name: string | null
  logo_url: string | null
  status: SellerStoreStatus
  consecutive_failures: number
  rotation_page: number
  created_at: string
  updated_at: string
}

export type NewSellerStore = Omit<SellerStore, 'id' | 'created_at' | 'updated_at'>

export interface SellerStoreSnapshot {
  id: number
  store_id: number
  public_rating: number | null
  feedback_count: number | null
  positive_30d: number | null
  positive_90d: number | null
  positive_365d: number | null
  reported_product_count: number | null
  scanned_product_count: number
  captured_at: string
  capture_status: StoreCaptureStatus
  error_type: string | null
  error_message: string | null
}

export type NewSellerStoreSnapshot = Omit<SellerStoreSnapshot, 'id'>

export interface SellerStoreProduct {
  id: number
  store_id: number
  asin: string
  title: string | null
  image_url: string | null
  listing_price: number | null
  currency: string | null
  rating: number | null
  review_count: number | null
  brand: string | null
  category: string | null
  detail_price: number | null
  regular_price: number | null
  list_price: number | null
  coupon: string | null
  deal_type: string | null
  availability: string | null
  is_watched: number
  presence_status: 'visible' | 'suspected_missing'
  missing_count: number
  first_seen_at: string
  last_seen_at: string
  listing_captured_at: string | null
  detail_captured_at: string | null
  last_seen_page: number | null
  updated_at: string
}

export interface SellerStoreEvent {
  id: number
  store_id: number
  product_id: number | null
  event_type: StoreEventType
  old_value: string | null
  new_value: string | null
  is_read: number
  detected_at: string
}

// --- Dashboard summary ---

export interface CompetitorSummary {
  competitor: Competitor
  latest_snapshot: Snapshot | null
  snapshot_count: number
  last_captured_at: string | null
}
