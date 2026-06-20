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
  CAPTURE_MANUAL_SAVE: 'capture:manual-save',
  SETTINGS_DELIVERY_LIST: 'settings:delivery-list',
  SETTINGS_DELIVERY_SAVE: 'settings:delivery-save',
  SELLER_STORES_ADD: 'seller-stores:add',
  SELLER_STORES_LIST: 'seller-stores:list',
  SELLER_STORES_GET: 'seller-stores:get',
  SELLER_STORES_DELETE: 'seller-stores:delete',
  SELLER_STORES_TOGGLE: 'seller-stores:toggle',
  SELLER_STORES_SCAN: 'seller-stores:scan',
  SELLER_STORE_PRODUCT_WATCH: 'seller-stores:product-watch',
  SELLER_STORE_PRODUCT_PROMOTE: 'seller-stores:product-promote',
  PAGE_BUDGET_STATUS: 'page-budget:status',
  PAGE_BUDGET_SAVE: 'page-budget:save'
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
  marketplace: string
}

export interface CaptureResponse {
  success: boolean
  asin?: string
  marketplace?: string
  url?: string
  title?: string | null
  price?: number | null
  currency?: string | null
  priceType?: string | null
  regularPrice?: number | null
  listPrice?: number | null
  deliveryLocation?: string | null
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
  latestCurrency: string | null
  latestPriceType: string | null
  latestRegularPrice: number | null
  latestListPrice: number | null
  latestDeliveryLocation: string | null
  latestRating: number | null
  latestReviewCount: number | null
  latestAvailability: string | null
  lastCapturedAt: string | null
  lastCaptureStatus: string | null
  nextRunAt: string | null
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
  monitorIntervalMinutes: number
  nextRunAt: string | null
  createdAt: string
  updatedAt: string
  snapshots: SnapshotItem[]
}

export interface SnapshotItem {
  id: number
  title: string | null
  price: number | null
  currency: string | null
  priceType: string | null
  regularPrice: number | null
  listPrice: number | null
  deliveryLocation: string | null
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
  competitorsUpdateInterval: (
    id: number,
    intervalMinutes: number
  ) => Promise<{ nextRunAt: string | null }>
  exportSingle: (
    competitorId: number
  ) => Promise<{ success: boolean; path?: string; error?: string }>
  exportAll: () => Promise<{ success: boolean; path?: string; error?: string }>
  schedulerStatus: () => Promise<{ state: string }>
  schedulerStart: () => Promise<void>
  schedulerStop: () => Promise<void>
  alertsList: () => Promise<AlertItem[]>
  alertsCountUnread: () => Promise<number>
  alertsMarkRead: (id: number) => Promise<void>
  alertsMarkAllRead: () => Promise<void>
  captureManualSave: (data: ManualCaptureData) => Promise<CaptureResponse>
  deliveryProfilesList: () => Promise<DeliveryProfile[]>
  deliveryProfilesSave: (profiles: DeliveryProfileUpdate[]) => Promise<DeliveryProfile[]>
  sellerStoresAdd: (url: string) => Promise<{ success: boolean; storeId?: number; error?: string }>
  sellerStoresList: () => Promise<SellerStoreListItem[]>
  sellerStoresGet: (id: number) => Promise<SellerStoreDetail | null>
  sellerStoresDelete: (id: number) => Promise<void>
  sellerStoresToggle: (id: number) => Promise<{ status: string }>
  sellerStoresScan: (id: number) => Promise<StoreScanResponse>
  sellerStoreProductWatch: (productId: number, watched: boolean) => Promise<void>
  sellerStoreProductPromote: (productId: number) => Promise<{ competitorId: number }>
  pageBudgetStatus: () => Promise<PageBudgetView>
  pageBudgetSave: (limit: number) => Promise<PageBudgetView>
}

export interface PageBudgetView {
  limit: number
  used: number
  remaining: number
  deferred: number
  cooldowns: Array<{ marketplace: string; reason: string; endsAt: string }>
}

export interface SellerStoreListItem {
  id: number
  sellerId: string
  marketplace: string
  name: string | null
  logoUrl: string | null
  status: string
  reportedProductCount: number | null
  scannedProductCount: number
  knownProductCount: number
  newCount: number
  missingCount: number
  lastCapturedAt: string | null
  lastCaptureStatus: string | null
}

export interface SellerStoreProductItem {
  id: number
  asin: string
  title: string | null
  imageUrl: string | null
  listingPrice: number | null
  detailPrice: number | null
  regularPrice: number | null
  listPrice: number | null
  currency: string | null
  rating: number | null
  reviewCount: number | null
  brand: string | null
  category: string | null
  coupon: string | null
  dealType: string | null
  availability: string | null
  watched: boolean
  presenceStatus: string
  firstSeenAt: string
  lastSeenAt: string
  listingCapturedAt: string | null
  detailCapturedAt: string | null
}

export interface SellerStoreEventItem {
  id: number
  productId: number | null
  eventType: string
  oldValue: string | null
  newValue: string | null
  detectedAt: string
}

export interface SellerStoreDetail extends SellerStoreListItem {
  profileUrl: string
  storefrontUrl: string
  publicRating: number | null
  feedbackCount: number | null
  positive30d: number | null
  positive90d: number | null
  positive365d: number | null
  products: SellerStoreProductItem[]
  events: SellerStoreEventItem[]
  budget: PageBudgetView
}

export interface StoreScanResponse {
  success: boolean
  deferred?: boolean
  scannedProducts: number
  deepProducts: number
  errorType?: string
  errorMessage?: string
}

export interface DeliveryProfile {
  marketplace: string
  currency: string
  locationMode: 'postalCode' | 'city'
  location: string
  defaultLocation: string
}

export interface DeliveryProfileUpdate {
  marketplace: string
  location: string
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
