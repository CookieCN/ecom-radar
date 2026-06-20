import { app, BrowserWindow, ipcMain, shell, dialog, Menu } from 'electron'
import { join } from 'path'
import { writeFileSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import {
  IPC_CHANNELS,
  HealthCheckResult,
  DbHealthCheckResult,
  CaptureRequest,
  CaptureResponse,
  CompetitorListItem,
  CompetitorDetail,
  AlertItem,
  ManualCaptureData,
  DeliveryProfile,
  DeliveryProfileUpdate,
  SellerStoreListItem,
  SellerStoreDetail,
  StoreScanResponse,
  PageBudgetView
} from '../shared/ipc'
import {
  initDatabase,
  getDatabase,
  closeDatabase,
  getDbPath,
  CompetitorsRepository,
  SnapshotsRepository,
  AlertsRepository,
  MonitorJobsRepository,
  SettingsRepository,
  SellerStoresRepository
} from '../data'
import { captureProduct, closeBrowser, setBrowsersPath, checkChromiumAvailable } from '../capture'
import type { NewSnapshot } from '../data/types'
import { startScheduler, stopScheduler, getSchedulerState } from '../scheduler'
import { runAlertRules } from '../alerts'
import {
  MARKETPLACE_CONFIGS,
  getDeliverySettingKey,
  getMarketplaceConfig
} from '../shared/marketplaces'
import { PageBudgetService, createNavigationAccessGuard } from '../monitoring/page-budget'
import { parseSellerStoreUrl, scanSellerStore } from '../storefront'

let mainWindow: BrowserWindow | null = null
const DEFAULT_MONITOR_INTERVAL_MINUTES = 360

if (process.env['ECOM_RADAR_DISABLE_GPU'] === '1') {
  app.disableHardwareAcceleration()
}

function toSqliteDatetime(date: Date): string {
  return date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, '')
}

function sqliteUtcToIso(value: string | null | undefined): string | null {
  if (!value) return null
  return value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
}

function getNextMonitorRun(intervalMinutes: number): string {
  return toSqliteDatetime(new Date(Date.now() + intervalMinutes * 60 * 1000))
}

function getDeliveryLocation(marketplace: string): string {
  const config = getMarketplaceConfig(marketplace)
  if (!config) return ''
  const settings = new SettingsRepository(getDatabase())
  return settings.getOrDefault(getDeliverySettingKey(marketplace), config.defaultLocation)
}

function listDeliveryProfiles(): DeliveryProfile[] {
  const settings = new SettingsRepository(getDatabase())
  return MARKETPLACE_CONFIGS.map((config) => ({
    marketplace: config.code,
    currency: config.currency,
    locationMode: config.locationMode,
    location: settings.getOrDefault(getDeliverySettingKey(config.code), config.defaultLocation),
    defaultLocation: config.defaultLocation
  }))
}

function sellerStoreListItem(id: number): SellerStoreListItem | null {
  const db = getDatabase()
  const repo = new SellerStoresRepository(db)
  const store = repo.findById(id)
  if (!store) return null
  const latest = repo.latestSnapshot(id)
  const products = repo.listProducts(id)
  const events = repo.listEvents(id, 500)
  const latestDate = latest?.captured_at?.slice(0, 10)
  return {
    id: store.id,
    sellerId: store.seller_id,
    marketplace: store.marketplace,
    name: store.name,
    logoUrl: store.logo_url,
    status: store.status,
    reportedProductCount: latest?.reported_product_count ?? null,
    scannedProductCount: latest?.scanned_product_count ?? 0,
    knownProductCount: products.length,
    newCount: events.filter(
      (event) => event.event_type === 'new_visible' && event.detected_at.slice(0, 10) === latestDate
    ).length,
    missingCount: products.filter((product) => product.presence_status === 'suspected_missing')
      .length,
    lastCapturedAt: latest?.captured_at ?? null,
    lastCaptureStatus: latest?.capture_status ?? null
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load renderer — HMR in dev, built files in production
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// IPC handlers
function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.HEALTH_CHECK, (): HealthCheckResult => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      electronVersion: process.versions.electron || 'unknown',
      nodeVersion: process.versions.node || 'unknown',
      platform: process.platform
    }
  })

  ipcMain.handle(IPC_CHANNELS.DB_HEALTH_CHECK, (): DbHealthCheckResult => {
    const db = getDatabase()
    const tables = [
      'competitors',
      'snapshots',
      'monitor_jobs',
      'alerts',
      'settings',
      'seller_stores',
      'seller_store_products',
      'page_access_log',
      '_migrations'
    ]
    const tableCounts: Record<string, number> = {}
    for (const table of tables) {
      const row = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get() as { cnt: number }
      tableCounts[table] = row.cnt
    }

    const migRow = db.prepare('SELECT MAX(version) as version FROM _migrations').get() as {
      version: number
    }
    return {
      status: 'ok',
      dbPath: getDbPath(),
      tableCounts,
      migrationVersion: migRow.version
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.CAPTURE_RUN,
    async (_event, request: CaptureRequest): Promise<CaptureResponse> => {
      const budget = new PageBudgetService(getDatabase())
      const result = await captureProduct(
        request.input,
        request.marketplace,
        getDeliveryLocation(request.marketplace),
        createNavigationAccessGuard(budget, request.marketplace, 'manual_competitor')
      )

      if (
        !result.success &&
        (result.errorType === 'PAGE_BUDGET_EXHAUSTED' ||
          result.errorType === 'MARKETPLACE_COOLDOWN')
      ) {
        return { success: false, errorType: result.errorType, errorMessage: result.errorMessage }
      }

      // If URL parsing failed entirely (no product), return error with no DB writes
      if (!result.success && !result.product) {
        return {
          success: false,
          errorType: (result as { errorType: string | null }).errorType ?? undefined,
          errorMessage: result.errorMessage
        }
      }

      // From here, URL parsing succeeded — product exists.
      // Always save a snapshot record so the user has a capture log entry.
      const product = result.product!
      const db = getDatabase()
      const competitorsRepo = new CompetitorsRepository(db)
      const snapshotsRepo = new SnapshotsRepository(db)
      const jobsRepo = new MonitorJobsRepository(db)

      // Find or create competitor
      let competitor = competitorsRepo.findByAsin(product.asin, product.marketplace)

      if (!competitor) {
        competitor = competitorsRepo.create({
          asin: product.asin,
          marketplace: product.marketplace,
          url: product.url,
          title: result.success ? result.snapshot.title : null,
          image_url: result.success ? result.snapshot.image_url : null,
          status: result.success ? 'active' : 'error',
          consecutive_failures: result.success ? 0 : 1
        })
      } else {
        if (result.success) {
          competitorsRepo.update(competitor.id, {
            title: result.snapshot.title ?? competitor.title,
            image_url: result.snapshot.image_url ?? competitor.image_url
          })
          competitorsRepo.resetFailures(competitor.id)
          if (competitor.status === 'error') {
            competitorsRepo.updateStatus(competitor.id, 'active')
          }
        } else {
          competitorsRepo.incrementFailures(competitor.id)
          const updated = competitorsRepo.findById(competitor.id)
          if (updated && updated.consecutive_failures >= 3) {
            competitorsRepo.updateStatus(competitor.id, 'paused')
          }
        }
      }

      if (!jobsRepo.findByCompetitorId(competitor.id)) {
        jobsRepo.create({
          competitor_id: competitor.id,
          interval_minutes: DEFAULT_MONITOR_INTERVAL_MINUTES,
          next_run_at: getNextMonitorRun(DEFAULT_MONITOR_INTERVAL_MINUTES),
          enabled: 1
        })
      }

      // Build snapshot to save
      const snapshotData: NewSnapshot = result.success
        ? result.snapshot
        : {
            competitor_id: competitor.id,
            title: null,
            price: null,
            currency: null,
            rating: null,
            review_count: null,
            availability: null,
            image_url: null,
            captured_at: new Date().toISOString(),
            capture_status: 'failed',
            error_type: result.errorType,
            error_message: result.errorMessage
          }

      const snapshot = snapshotsRepo.create({
        ...snapshotData,
        competitor_id: competitor.id
      })

      // Run alert rules on successful capture
      if (result.success) {
        runAlertRules(competitor.id, snapshot)
      }

      return {
        success: result.success,
        asin: product.asin,
        marketplace: product.marketplace,
        url: product.url,
        title: snapshot.title,
        price: snapshot.price,
        currency: snapshot.currency,
        priceType: snapshot.price_type,
        regularPrice: snapshot.regular_price,
        listPrice: snapshot.list_price,
        deliveryLocation: snapshot.delivery_location,
        rating: snapshot.rating,
        reviewCount: snapshot.review_count,
        availability: snapshot.availability,
        imageUrl: snapshot.image_url,
        capturedAt: snapshot.captured_at,
        snapshotId: snapshot.id,
        competitorId: competitor.id,
        errorType: result.success ? undefined : (result.errorType ?? undefined),
        errorMessage: result.success ? undefined : result.errorMessage
      }
    }
  )

  // --- Manual capture handler ---

  ipcMain.handle(
    IPC_CHANNELS.CAPTURE_MANUAL_SAVE,
    async (_event, data: ManualCaptureData): Promise<CaptureResponse> => {
      const db = getDatabase()
      const competitorsRepo = new CompetitorsRepository(db)
      const snapshotsRepo = new SnapshotsRepository(db)

      const competitor = competitorsRepo.findById(data.competitorId)
      if (!competitor) {
        return { success: false, errorType: 'PARSER_FAILED', errorMessage: 'Competitor not found' }
      }

      // Update competitor title if provided
      if (data.title) {
        competitorsRepo.update(competitor.id, { title: data.title })
      }

      // Save manual snapshot
      const snapshot = snapshotsRepo.create({
        competitor_id: competitor.id,
        title: data.title || competitor.title,
        price: data.price,
        currency: getMarketplaceConfig(competitor.marketplace)?.currency ?? null,
        price_type: 'MANUAL',
        delivery_location: getDeliveryLocation(competitor.marketplace),
        rating: data.rating,
        review_count: data.reviewCount,
        availability: data.availability || null,
        image_url: competitor.image_url,
        captured_at: new Date().toISOString(),
        capture_status: 'success',
        error_type: null,
        error_message: null
      })

      // Reset failure count — user manually confirmed data is good
      competitorsRepo.resetFailures(competitor.id)
      if (competitor.status === 'error' || competitor.status === 'paused') {
        competitorsRepo.updateStatus(competitor.id, 'active')
      }

      // Run alert rules
      runAlertRules(competitor.id, snapshot)

      return {
        success: true,
        asin: competitor.asin,
        marketplace: competitor.marketplace,
        url: competitor.url,
        title: snapshot.title,
        price: snapshot.price,
        currency: snapshot.currency,
        priceType: snapshot.price_type,
        regularPrice: snapshot.regular_price,
        listPrice: snapshot.list_price,
        deliveryLocation: snapshot.delivery_location,
        rating: snapshot.rating,
        reviewCount: snapshot.review_count,
        availability: snapshot.availability,
        imageUrl: snapshot.image_url,
        capturedAt: snapshot.captured_at,
        snapshotId: snapshot.id,
        competitorId: competitor.id
      }
    }
  )

  // --- Competitor management handlers ---

  ipcMain.handle(IPC_CHANNELS.COMPETITORS_LIST, (): CompetitorListItem[] => {
    const db = getDatabase()
    const competitorsRepo = new CompetitorsRepository(db)
    const snapshotsRepo = new SnapshotsRepository(db)
    const jobsRepo = new MonitorJobsRepository(db)
    const competitors = competitorsRepo.findAll()

    return competitors.map((c) => {
      const latest = snapshotsRepo.findLatest(c.id)
      const job = jobsRepo.findByCompetitorId(c.id)
      const count = snapshotsRepo.countByCompetitorId(c.id)
      return {
        id: c.id,
        asin: c.asin,
        marketplace: c.marketplace,
        url: c.url,
        title: c.title,
        imageUrl: c.image_url,
        status: c.status,
        consecutiveFailures: c.consecutive_failures,
        latestPrice: latest?.price ?? null,
        latestCurrency: latest?.currency ?? null,
        latestPriceType: latest?.price_type ?? null,
        latestRegularPrice: latest?.regular_price ?? null,
        latestListPrice: latest?.list_price ?? null,
        latestDeliveryLocation: latest?.delivery_location ?? null,
        latestRating: latest?.rating ?? null,
        latestReviewCount: latest?.review_count ?? null,
        latestAvailability: latest?.availability ?? null,
        lastCapturedAt: latest?.captured_at ?? null,
        lastCaptureStatus: latest?.capture_status ?? null,
        nextRunAt: sqliteUtcToIso(job?.next_run_at),
        snapshotCount: count,
        createdAt: c.created_at
      }
    })
  })

  ipcMain.handle(IPC_CHANNELS.COMPETITORS_GET, (_event, id: number): CompetitorDetail | null => {
    const db = getDatabase()
    const competitorsRepo = new CompetitorsRepository(db)
    const snapshotsRepo = new SnapshotsRepository(db)
    const jobsRepo = new MonitorJobsRepository(db)

    const competitor = competitorsRepo.findById(id)
    if (!competitor) return null

    const snapshots = snapshotsRepo.findByCompetitorId(id, 100)
    let job = jobsRepo.findByCompetitorId(id)
    if (!job) {
      job = jobsRepo.create({
        competitor_id: id,
        interval_minutes: DEFAULT_MONITOR_INTERVAL_MINUTES,
        next_run_at: getNextMonitorRun(DEFAULT_MONITOR_INTERVAL_MINUTES),
        enabled: 1
      })
    }

    return {
      id: competitor.id,
      asin: competitor.asin,
      marketplace: competitor.marketplace,
      url: competitor.url,
      title: competitor.title,
      imageUrl: competitor.image_url,
      status: competitor.status,
      consecutiveFailures: competitor.consecutive_failures,
      monitorIntervalMinutes: job.interval_minutes,
      nextRunAt: sqliteUtcToIso(job.next_run_at),
      createdAt: competitor.created_at,
      updatedAt: competitor.updated_at,
      snapshots: snapshots.map((s) => ({
        id: s.id,
        title: s.title,
        price: s.price,
        currency: s.currency,
        priceType: s.price_type,
        regularPrice: s.regular_price,
        listPrice: s.list_price,
        deliveryLocation: s.delivery_location,
        rating: s.rating,
        reviewCount: s.review_count,
        availability: s.availability,
        imageUrl: s.image_url,
        capturedAt: s.captured_at,
        captureStatus: s.capture_status,
        errorType: s.error_type,
        errorMessage: s.error_message
      }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.COMPETITORS_DELETE, (_event, id: number): void => {
    const db = getDatabase()
    const competitorsRepo = new CompetitorsRepository(db)
    competitorsRepo.delete(id)
  })

  ipcMain.handle(
    IPC_CHANNELS.COMPETITORS_TOGGLE_STATUS,
    (_event, id: number): { status: string } => {
      const db = getDatabase()
      const competitorsRepo = new CompetitorsRepository(db)
      const competitor = competitorsRepo.findById(id)
      if (!competitor) return { status: 'active' }

      const newStatus = competitor.status === 'paused' ? 'active' : 'paused'
      competitorsRepo.updateStatus(id, newStatus)
      return { status: newStatus }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.COMPETITORS_UPDATE_INTERVAL,
    (_event, id: number, intervalMinutes: number): { nextRunAt: string | null } => {
      const db = getDatabase()
      const jobsRepo = new MonitorJobsRepository(db)
      const job = jobsRepo.findByCompetitorId(id)
      const nextRunAt = getNextMonitorRun(intervalMinutes)
      if (job) {
        jobsRepo.updateInterval(job.id, intervalMinutes)
        jobsRepo.updateNextRun(job.id, nextRunAt)
      } else {
        jobsRepo.create({
          competitor_id: id,
          interval_minutes: intervalMinutes,
          next_run_at: nextRunAt,
          enabled: 1
        })
      }
      return { nextRunAt: sqliteUtcToIso(nextRunAt) }
    }
  )

  // --- Export handlers ---

  ipcMain.handle(IPC_CHANNELS.SETTINGS_DELIVERY_LIST, (): DeliveryProfile[] => {
    return listDeliveryProfiles()
  })

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_DELIVERY_SAVE,
    (_event, profiles: DeliveryProfileUpdate[]): DeliveryProfile[] => {
      const settings = new SettingsRepository(getDatabase())
      const entries: Record<string, string> = {}
      for (const profile of profiles) {
        const config = getMarketplaceConfig(profile.marketplace)
        const location = profile.location.trim()
        if (!config || !location || location.length > 64) continue
        entries[getDeliverySettingKey(config.code)] = location
      }
      settings.setMultiple(entries)
      return listDeliveryProfiles()
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SELLER_STORES_ADD,
    (_event, input: string): { success: boolean; storeId?: number; error?: string } => {
      try {
        const parsed = parseSellerStoreUrl(input)
        const repo = new SellerStoresRepository(getDatabase())
        const existing = repo.findBySellerId(parsed.sellerId, parsed.marketplace)
        if (existing) return { success: true, storeId: existing.id }
        if (repo.findAll().length >= 5)
          return { success: false, error: 'Seller Storefront monitoring supports up to 5 stores.' }
        const store = repo.create({
          seller_id: parsed.sellerId,
          marketplace: parsed.marketplace,
          profile_url: parsed.profileUrl,
          storefront_url: parsed.storefrontUrl,
          name: null,
          logo_url: null,
          status: 'active',
          consecutive_failures: 0,
          rotation_page: 2
        })
        repo.ensureJob(store.id)
        return { success: true, storeId: store.id }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.SELLER_STORES_LIST, (): SellerStoreListItem[] => {
    const repo = new SellerStoresRepository(getDatabase())
    return repo
      .findAll()
      .map((store) => sellerStoreListItem(store.id)!)
      .filter(Boolean)
  })

  ipcMain.handle(IPC_CHANNELS.SELLER_STORES_GET, (_event, id: number): SellerStoreDetail | null => {
    const db = getDatabase()
    const repo = new SellerStoresRepository(db)
    const store = repo.findById(id)
    const base = sellerStoreListItem(id)
    if (!store || !base) return null
    const snapshot = repo.latestSnapshot(id)
    return {
      ...base,
      profileUrl: store.profile_url,
      storefrontUrl: store.storefront_url,
      publicRating: snapshot?.public_rating ?? null,
      feedbackCount: snapshot?.feedback_count ?? null,
      positive30d: snapshot?.positive_30d ?? null,
      positive90d: snapshot?.positive_90d ?? null,
      positive365d: snapshot?.positive_365d ?? null,
      products: repo.listProducts(id).map((product) => ({
        id: product.id,
        asin: product.asin,
        title: product.title,
        imageUrl: product.image_url,
        listingPrice: product.listing_price,
        detailPrice: product.detail_price,
        regularPrice: product.regular_price,
        listPrice: product.list_price,
        currency: product.currency,
        rating: product.rating,
        reviewCount: product.review_count,
        brand: product.brand,
        category: product.category,
        coupon: product.coupon,
        dealType: product.deal_type,
        availability: product.availability,
        watched: product.is_watched === 1,
        presenceStatus: product.presence_status,
        firstSeenAt: product.first_seen_at,
        lastSeenAt: product.last_seen_at,
        listingCapturedAt: product.listing_captured_at,
        detailCapturedAt: product.detail_captured_at
      })),
      events: repo.listEvents(id).map((event) => ({
        id: event.id,
        productId: event.product_id,
        eventType: event.event_type,
        oldValue: event.old_value,
        newValue: event.new_value,
        detectedAt: event.detected_at
      })),
      budget: new PageBudgetService(db).status()
    }
  })

  ipcMain.handle(IPC_CHANNELS.SELLER_STORES_DELETE, (_event, id: number): void => {
    new SellerStoresRepository(getDatabase()).delete(id)
  })

  ipcMain.handle(IPC_CHANNELS.SELLER_STORES_TOGGLE, (_event, id: number): { status: string } => {
    const repo = new SellerStoresRepository(getDatabase())
    const store = repo.findById(id)
    if (!store) return { status: 'error' }
    const status = store.status === 'paused' ? 'active' : 'paused'
    repo.update(id, { status })
    repo.ensureJob(id)
    return { status }
  })

  ipcMain.handle(
    IPC_CHANNELS.SELLER_STORES_SCAN,
    async (_event, id: number): Promise<StoreScanResponse> => {
      const db = getDatabase()
      const store = new SellerStoresRepository(db).findById(id)
      if (!store)
        return {
          success: false,
          scannedProducts: 0,
          deepProducts: 0,
          errorMessage: 'Seller store not found.'
        }
      return scanSellerStore(db, store)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SELLER_STORE_PRODUCT_WATCH,
    (_event, productId: number, watched: boolean): void => {
      new SellerStoresRepository(getDatabase()).setWatched(productId, watched)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SELLER_STORE_PRODUCT_PROMOTE,
    (_event, productId: number): { competitorId: number } => {
      const db = getDatabase()
      const stores = new SellerStoresRepository(db)
      const product = stores.findProductById(productId)
      if (!product) throw new Error('Store product not found.')
      const store = stores.findById(product.store_id)!
      const config = getMarketplaceConfig(store.marketplace)!
      const competitors = new CompetitorsRepository(db)
      let competitor = competitors.findByAsin(product.asin, store.marketplace)
      if (!competitor) {
        competitor = competitors.create({
          asin: product.asin,
          marketplace: store.marketplace,
          url: `https://www.${config.domain}/dp/${product.asin}`,
          title: product.title,
          image_url: product.image_url,
          status: 'active',
          consecutive_failures: 0
        })
      }
      const jobs = new MonitorJobsRepository(db)
      if (!jobs.findByCompetitorId(competitor.id)) {
        jobs.create({
          competitor_id: competitor.id,
          interval_minutes: 1440,
          next_run_at: null,
          enabled: 1
        })
      }
      return { competitorId: competitor.id }
    }
  )

  ipcMain.handle(IPC_CHANNELS.PAGE_BUDGET_STATUS, (): PageBudgetView => {
    return new PageBudgetService(getDatabase()).status()
  })

  ipcMain.handle(IPC_CHANNELS.PAGE_BUDGET_SAVE, (_event, limit: number): PageBudgetView => {
    const service = new PageBudgetService(getDatabase())
    service.setLimit(limit)
    return service.status()
  })

  ipcMain.handle(
    IPC_CHANNELS.EXPORT_SINGLE,
    async (
      _event,
      competitorId: number
    ): Promise<{ success: boolean; path?: string; error?: string }> => {
      const db = getDatabase()
      const competitorsRepo = new CompetitorsRepository(db)
      const snapshotsRepo = new SnapshotsRepository(db)

      const competitor = competitorsRepo.findById(competitorId)
      if (!competitor) return { success: false, error: 'Competitor not found' }

      const snapshots = snapshotsRepo.findByCompetitorId(competitorId, 10000)
      const csv = buildSnapshotCsv(competitor.title || competitor.asin, snapshots)

      const result = await dialog.showSaveDialog({
        title: 'Export Competitor Data',
        defaultPath: `${competitor.asin}_snapshots.csv`,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Save cancelled' }
      }

      writeFileSync(result.filePath, csv, 'utf-8')
      return { success: true, path: result.filePath }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.EXPORT_ALL,
    async (): Promise<{ success: boolean; path?: string; error?: string }> => {
      const db = getDatabase()
      const competitorsRepo = new CompetitorsRepository(db)
      const snapshotsRepo = new SnapshotsRepository(db)

      const competitors = competitorsRepo.findAll()
      if (competitors.length === 0) return { success: false, error: 'No competitors to export' }

      const allCsv = competitors
        .map((c) => {
          const snaps = snapshotsRepo.findByCompetitorId(c.id, 10000)
          return buildSnapshotCsv(c.title || c.asin, snaps)
        })
        .join('\n\n')

      const result = await dialog.showSaveDialog({
        title: 'Export All Competitors',
        defaultPath: `competitor-radar-export.csv`,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Save cancelled' }
      }

      writeFileSync(result.filePath, allCsv, 'utf-8')
      return { success: true, path: result.filePath }
    }
  )

  // --- Scheduler handlers ---

  ipcMain.handle(IPC_CHANNELS.SCHEDULER_STATUS, () => {
    return { state: getSchedulerState() }
  })

  ipcMain.handle(IPC_CHANNELS.SCHEDULER_START, () => {
    startScheduler()
  })

  ipcMain.handle(IPC_CHANNELS.SCHEDULER_STOP, () => {
    stopScheduler()
  })

  // --- Alert handlers ---

  ipcMain.handle(IPC_CHANNELS.ALERTS_LIST, (): AlertItem[] => {
    const db = getDatabase()
    const alertsRepo = new AlertsRepository(db)
    const competitorsRepo = new CompetitorsRepository(db)
    const alerts = alertsRepo.findAll(100)

    const productAlerts = alerts.map((a) => {
      const competitor = competitorsRepo.findById(a.competitor_id)
      return {
        id: a.id,
        competitorId: a.competitor_id,
        competitorAsin: competitor?.asin ?? 'unknown',
        alertType: a.alert_type,
        title: a.title,
        message: a.message,
        isRead: a.is_read,
        createdAt: a.created_at
      }
    })
    const storeAlerts = db
      .prepare(
        `SELECT e.*, s.name store_name, s.seller_id
         FROM seller_store_events e JOIN seller_stores s ON s.id=e.store_id
         ORDER BY e.detected_at DESC LIMIT 100`
      )
      .all() as Array<{
      id: number
      store_id: number
      event_type: string
      old_value: string | null
      new_value: string | null
      is_read: number
      detected_at: string
      store_name: string | null
      seller_id: string
    }>
    return [
      ...productAlerts,
      ...storeAlerts.map((event) => ({
        id: -event.id,
        competitorId: -event.store_id,
        competitorAsin: event.store_name ?? event.seller_id,
        alertType: event.event_type,
        title: 'Seller Storefront change',
        message:
          [event.old_value, event.new_value].filter(Boolean).join(' -> ') || event.event_type,
        isRead: event.is_read,
        createdAt: event.detected_at
      }))
    ]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100)
  })

  ipcMain.handle(IPC_CHANNELS.ALERTS_COUNT_UNREAD, (): number => {
    const db = getDatabase()
    const alertsRepo = new AlertsRepository(db)
    const storeUnread = db
      .prepare('SELECT COUNT(*) count FROM seller_store_events WHERE is_read=0')
      .get() as { count: number }
    return alertsRepo.countUnread() + storeUnread.count
  })

  ipcMain.handle(IPC_CHANNELS.ALERTS_MARK_READ, (_event, id: number): void => {
    const db = getDatabase()
    const alertsRepo = new AlertsRepository(db)
    if (id < 0) db.prepare('UPDATE seller_store_events SET is_read=1 WHERE id=?').run(-id)
    else alertsRepo.markAsRead(id)
  })

  ipcMain.handle(IPC_CHANNELS.ALERTS_MARK_ALL_READ, (): void => {
    const db = getDatabase()
    const alertsRepo = new AlertsRepository(db)
    alertsRepo.markAllAsRead()
    db.prepare('UPDATE seller_store_events SET is_read=1').run()
  })
}

// CSV export helpers — in this file to avoid creating extra modules just for CSV
function escapeCsvField(field: string | number | null): string {
  if (field === null || field === undefined) return ''
  const s = String(field)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

interface CsvSnapshotRow {
  captured_at: string
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
  capture_status: string
  error_type: string | null
  error_message: string | null
}

function buildSnapshotCsv(productName: string, snapshots: CsvSnapshotRow[]): string {
  // BOM for Excel UTF-8 support
  const BOM = '﻿'
  const header =
    'Product,Time,Price,Currency,Price Type,Regular Price,List Price,Delivery Location,Rating,Reviews,Availability,Status,Error Type,Error Message'
  const rows = snapshots.map((s) =>
    [
      escapeCsvField(productName),
      escapeCsvField(s.captured_at),
      s.price !== null ? s.price : '',
      escapeCsvField(s.currency),
      escapeCsvField(s.price_type),
      s.regular_price !== null ? s.regular_price : '',
      s.list_price !== null ? s.list_price : '',
      escapeCsvField(s.delivery_location),
      s.rating !== null ? s.rating : '',
      s.review_count !== null ? s.review_count : '',
      escapeCsvField(s.availability),
      escapeCsvField(s.capture_status),
      escapeCsvField(s.error_type),
      escapeCsvField(s.error_message)
    ].join(',')
  )
  return BOM + [header, ...rows].join('\n')
}

app.whenReady().then(() => {
  // Initialize database before creating window
  initDatabase()

  // Configure Playwright browser path
  // In packaged app: bundled in extraResources/playwright-browsers
  // In dev mode: Playwright's default cache directory
  if (app.isPackaged) {
    const bundledPath = join(process.resourcesPath, 'playwright-browsers')
    setBrowsersPath(bundledPath)
  }
  // In dev, don't set — Playwright uses its default cache

  // Verify Chromium is available
  const chromiumError = checkChromiumAvailable()
  if (chromiumError) {
    console.warn('Chromium check:', chromiumError)
  }

  // Hide native menu bar — app uses in-app navigation
  Menu.setApplicationMenu(null)

  registerIpcHandlers()
  createWindow()

  // Auto-start scheduler
  startScheduler()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  stopScheduler()
  await closeBrowser()
  closeDatabase()
})
