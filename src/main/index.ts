import { app, BrowserWindow, ipcMain, shell, dialog, Menu } from 'electron'
import { join } from 'path'
import { writeFileSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import { IPC_CHANNELS, HealthCheckResult, DbHealthCheckResult, CaptureRequest, CaptureResponse, CompetitorListItem, CompetitorDetail, AlertItem, ManualCaptureData } from '../shared/ipc'
import { initDatabase, getDatabase, closeDatabase, getDbPath, CompetitorsRepository, SnapshotsRepository, AlertsRepository, MonitorJobsRepository } from '../data'
import { captureProduct, closeBrowser, setBrowsersPath, checkChromiumAvailable } from '../capture'
import type { NewSnapshot } from '../data/types'
import { startScheduler, stopScheduler, getSchedulerState } from '../scheduler'
import { runAlertRules } from '../alerts'

let mainWindow: BrowserWindow | null = null

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
      '_migrations'
    ]
    const tableCounts: Record<string, number> = {}
    for (const table of tables) {
      const row = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get() as { cnt: number }
      tableCounts[table] = row.cnt
    }

    const migRow = db
      .prepare('SELECT MAX(version) as version FROM _migrations')
      .get() as { version: number }
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
      const result = await captureProduct(request.input)

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
        currency: 'USD',
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
    const competitors = competitorsRepo.findAll()

    return competitors.map((c) => {
      const latest = snapshotsRepo.findLatest(c.id)
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
        latestRating: latest?.rating ?? null,
        latestReviewCount: latest?.review_count ?? null,
        latestAvailability: latest?.availability ?? null,
        lastCapturedAt: latest?.captured_at ?? null,
        lastCaptureStatus: latest?.capture_status ?? null,
        snapshotCount: count,
        createdAt: c.created_at
      }
    })
  })

  ipcMain.handle(
    IPC_CHANNELS.COMPETITORS_GET,
    (_event, id: number): CompetitorDetail | null => {
      const db = getDatabase()
      const competitorsRepo = new CompetitorsRepository(db)
      const snapshotsRepo = new SnapshotsRepository(db)

      const competitor = competitorsRepo.findById(id)
      if (!competitor) return null

      const snapshots = snapshotsRepo.findByCompetitorId(id, 100)

      return {
        id: competitor.id,
        asin: competitor.asin,
        marketplace: competitor.marketplace,
        url: competitor.url,
        title: competitor.title,
        imageUrl: competitor.image_url,
        status: competitor.status,
        consecutiveFailures: competitor.consecutive_failures,
        createdAt: competitor.created_at,
        updatedAt: competitor.updated_at,
        snapshots: snapshots.map((s) => ({
          id: s.id,
          title: s.title,
          price: s.price,
          currency: s.currency,
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
    }
  )

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
    (_event, id: number, intervalMinutes: number): void => {
      const db = getDatabase()
      const jobsRepo = new MonitorJobsRepository(db)
      const job = jobsRepo.findByCompetitorId(id)
      if (job) {
        jobsRepo.updateInterval(job.id, intervalMinutes)
      }
    }
  )

  // --- Export handlers ---

  ipcMain.handle(
    IPC_CHANNELS.EXPORT_SINGLE,
    async (_event, competitorId: number): Promise<{ success: boolean; path?: string; error?: string }> => {
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

    return alerts.map((a) => {
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
  })

  ipcMain.handle(IPC_CHANNELS.ALERTS_COUNT_UNREAD, (): number => {
    const db = getDatabase()
    const alertsRepo = new AlertsRepository(db)
    return alertsRepo.countUnread()
  })

  ipcMain.handle(IPC_CHANNELS.ALERTS_MARK_READ, (_event, id: number): void => {
    const db = getDatabase()
    const alertsRepo = new AlertsRepository(db)
    alertsRepo.markAsRead(id)
  })

  ipcMain.handle(IPC_CHANNELS.ALERTS_MARK_ALL_READ, (): void => {
    const db = getDatabase()
    const alertsRepo = new AlertsRepository(db)
    alertsRepo.markAllAsRead()
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
    'Product,Time,Price,Currency,Rating,Reviews,Availability,Status,Error Type,Error Message'
  const rows = snapshots.map((s) =>
    [
      escapeCsvField(productName),
      escapeCsvField(s.captured_at),
      s.price !== null ? s.price : '',
      escapeCsvField(s.currency),
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
