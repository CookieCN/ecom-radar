// IPC channel names — single source of truth for main, preload, and renderer

export const IPC_CHANNELS = {
  HEALTH_CHECK: 'health:check',
  DB_HEALTH_CHECK: 'db:health-check',
  CAPTURE_RUN: 'capture:run',
  COMPETITORS_LIST: 'competitors:list',
  COMPETITORS_GET: 'competitors:get',
  COMPETITORS_DELETE: 'competitors:delete',
  COMPETITORS_TOGGLE_STATUS: 'competitors:toggle-status',
  COMPETITORS_UPDATE_INTERVAL: 'competitors:update-interval',
  EXPORT_SINGLE: 'export:single',
  EXPORT_ALL: 'export:all',
  SCHEDULER_STATUS: 'scheduler:status',
  SCHEDULER_START: 'scheduler:start',
  SCHEDULER_STOP: 'scheduler:stop',
  ALERTS_LIST: 'alerts:list',
  ALERTS_COUNT_UNREAD: 'alerts:count-unread',
  ALERTS_MARK_READ: 'alerts:mark-read',
  ALERTS_MARK_ALL_READ: 'alerts:mark-all-read',
  CAPTURE_MANUAL_SAVE: 'capture:manual-save'
} as const

// Health check
export interface HealthCheckResult {
  status: 'ok' | 'error'
  timestamp: string
  electronVersion: string
  nodeVersion: string
  platform: string
}

export interface DbHealthCheckResult {
  status: 'ok' | 'error'
  dbPath: string
  tableCounts: Record<string, number>
  migrationVersion: number
}

// Capture
export interface CaptureRequest {
  input: string
}

export interface CaptureResponse {
  success: boolean
  asin?: string
  marketplace?: string
  url?: string
  title?: string | null
  price?: number | null
  currency?: string | null
  rating?: number | null
  reviewCount?: number | null
  availability?: string | null
  imageUrl?: string | null
  capturedAt?: string
  snapshotId?: number
  competitorId?: number
  errorType?: string
  errorMessage?: string
}

// Competitor list item (summary with latest snapshot)
export interface CompetitorListItem {
  id: number
  asin: string
  marketplace: string
  url: string
  title: string | null
  imageUrl: string | null
  status: string
  consecutiveFailures: number
  latestPrice: number | null
  latestRating: number | null
  latestReviewCount: number | null
  latestAvailability: string | null
  lastCapturedAt: string | null
  lastCaptureStatus: string | null
  snapshotCount: number
  createdAt: string
}

// Competitor detail (with snapshot history)
export interface CompetitorDetail {
  id: number
  asin: string
  marketplace: string
  url: string
  title: string | null
  imageUrl: string | null
  status: string
  consecutiveFailures: number
  createdAt: string
  updatedAt: string
  snapshots: SnapshotItem[]
}

export interface SnapshotItem {
  id: number
  title: string | null
  price: number | null
  currency: string | null
  rating: number | null
  reviewCount: number | null
  availability: string | null
  imageUrl: string | null
  capturedAt: string
  captureStatus: string
  errorType: string | null
  errorMessage: string | null
}

// API surface exposed to renderer via contextBridge
export interface ElectronAPI {
  healthCheck: () => Promise<HealthCheckResult>
  dbHealthCheck: () => Promise<DbHealthCheckResult>
  captureRun: (request: CaptureRequest) => Promise<CaptureResponse>
  competitorsList: () => Promise<CompetitorListItem[]>
  competitorsGet: (id: number) => Promise<CompetitorDetail | null>
  competitorsDelete: (id: number) => Promise<void>
  competitorsToggleStatus: (id: number) => Promise<{ status: string }>
  competitorsUpdateInterval: (id: number, intervalMinutes: number) => Promise<void>
  exportSingle: (competitorId: number) => Promise<{ success: boolean; path?: string; error?: string }>
  exportAll: () => Promise<{ success: boolean; path?: string; error?: string }>
  schedulerStatus: () => Promise<{ state: string }>
  schedulerStart: () => Promise<void>
  schedulerStop: () => Promise<void>
  alertsList: () => Promise<AlertItem[]>
  alertsCountUnread: () => Promise<number>
  alertsMarkRead: (id: number) => Promise<void>
  alertsMarkAllRead: () => Promise<void>
  captureManualSave: (data: ManualCaptureData) => Promise<CaptureResponse>
}

export interface ManualCaptureData {
  competitorId: number
  title: string
  price: number | null
  rating: number | null
  reviewCount: number | null
  availability: string
}

export interface AlertItem {
  id: number
  competitorId: number
  competitorAsin: string
  alertType: string
  title: string
  message: string
  isRead: number
  createdAt: string
}
