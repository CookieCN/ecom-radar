// ============================================================
// Local scheduler — sequential queue, random delays, auto-pause
// ============================================================

import { getDatabase } from '../data'
import { CompetitorsRepository } from '../data/repositories/competitors'
import { SnapshotsRepository } from '../data/repositories/snapshots'
import { MonitorJobsRepository } from '../data/repositories/monitor_jobs'
import { SettingsRepository } from '../data/repositories/settings'
import { captureProduct } from '../capture'
import { runAlertRules } from '../alerts'
import { getDeliverySettingKey, getMarketplaceConfig } from '../shared/marketplaces'
import { PageBudgetService, createNavigationAccessGuard } from '../monitoring/page-budget'
import { SellerStoresRepository } from '../data/repositories/seller_stores'
import { scanSellerStore } from '../storefront'

const POLL_INTERVAL_MS = 60_000 // check for due jobs every 60 seconds
const DEFAULT_JOB_INTERVAL_MINUTES = 360 // 6 hours
const MAX_DAILY_AUTO_CAPTURES = 2
const MIN_DELAY_BETWEEN_JOBS_MS = 2 * 60_000

/** Convert Date to SQLite-compatible datetime string: YYYY-MM-DD HH:mm:ss */
function toSqliteDatetime(date: Date): string {
  return date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, '')
}

function getLocalDayBounds(date = new Date()): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: toSqliteDatetime(start), end: toSqliteDatetime(end) }
}

function getNextMorning(date = new Date()): string {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 9, 0, 0)
  return toSqliteDatetime(next)
}

function countCapturesToday(db: ReturnType<typeof getDatabase>, competitorId: number): number {
  const { start, end } = getLocalDayBounds()
  const row = db
    .prepare(
      `SELECT COUNT(*) as count
       FROM snapshots
       WHERE competitor_id = ?
         AND datetime(captured_at) >= datetime(?)
         AND datetime(captured_at) < datetime(?)`
    )
    .get(competitorId, start, end) as { count: number }
  return row.count
}

function scheduleNextRun(
  jobId: number,
  intervalMinutes: number,
  jobsRepo: MonitorJobsRepository,
  db: ReturnType<typeof getDatabase>,
  competitorId: number
): void {
  if (countCapturesToday(db, competitorId) >= MAX_DAILY_AUTO_CAPTURES) {
    jobsRepo.updateNextRun(jobId, getNextMorning())
    return
  }

  const intervalMs = intervalMinutes * 60 * 1000
  const jitter = Math.floor(Math.random() * 15 * 60 * 1000) // 0-15 min jitter
  const nextRun = toSqliteDatetime(new Date(Date.now() + intervalMs + jitter))
  jobsRepo.updateNextRun(jobId, nextRun)
}
const MAX_DELAY_BETWEEN_JOBS_MS = 5 * 60_000

type SchedulerState = 'stopped' | 'running' | 'paused'

let _state: SchedulerState = 'stopped'
let _timer: ReturnType<typeof setInterval> | null = null
let _processing = false

export function getSchedulerState(): SchedulerState {
  return _state
}

export function startScheduler(): void {
  if (_state === 'running') return
  _state = 'running'

  // Ensure every competitor has a monitor job
  ensureJobsExist()

  // Start polling
  _timer = setInterval(processDueJobs, POLL_INTERVAL_MS)

  // Run immediately on start
  processDueJobs()
}

export function stopScheduler(): void {
  _state = 'stopped'
  if (_timer) {
    clearInterval(_timer)
    _timer = null
  }
}

export function pauseScheduler(): void {
  if (_state === 'running') {
    _state = 'paused'
  }
}

export function resumeScheduler(): void {
  if (_state === 'paused') {
    _state = 'running'
  }
}

// ============================================================
// Internal
// ============================================================

function ensureJobsExist(): void {
  const db = getDatabase()
  const competitorsRepo = new CompetitorsRepository(db)
  const jobsRepo = new MonitorJobsRepository(db)

  const active = competitorsRepo.findAll('active')
  for (const c of active) {
    const existing = jobsRepo.findByCompetitorId(c.id)
    if (!existing) {
      jobsRepo.create({
        competitor_id: c.id,
        interval_minutes: DEFAULT_JOB_INTERVAL_MINUTES,
        next_run_at: null, // null = due now
        enabled: 1
      })
    }
  }
}

async function processDueJobs(): Promise<void> {
  if (_state !== 'running' || _processing) return

  _processing = true

  try {
    const db = getDatabase()
    const competitorsRepo = new CompetitorsRepository(db)
    const snapshotsRepo = new SnapshotsRepository(db)
    const jobsRepo = new MonitorJobsRepository(db)
    const budgetService = new PageBudgetService(db)

    const dueJobs = jobsRepo.findAllDue()
    const dueJobsFiltered = dueJobs.filter((j) => {
      const c = competitorsRepo.findById(j.competitor_id)
      return c && c.status === 'active'
    })

    for (const job of dueJobsFiltered) {
      // Re-check state between jobs
      if (_state !== 'running') break

      const competitor = competitorsRepo.findById(job.competitor_id)
      if (!competitor || competitor.status !== 'active') continue

      if (countCapturesToday(db, competitor.id) >= MAX_DAILY_AUTO_CAPTURES) {
        jobsRepo.updateNextRun(job.id, getNextMorning())
        continue
      }

      // Run capture
      const config = getMarketplaceConfig(competitor.marketplace)
      const settingsRepo = new SettingsRepository(db)
      const deliveryLocation = config
        ? settingsRepo.getOrDefault(getDeliverySettingKey(config.code), config.defaultLocation)
        : ''
      const result = await captureProduct(
        competitor.url,
        competitor.marketplace,
        deliveryLocation,
        createNavigationAccessGuard(
          budgetService,
          competitor.marketplace,
          'competitor',
          competitor.id
        )
      )

      if (
        !result.success &&
        (result.errorType === 'PAGE_BUDGET_EXHAUSTED' ||
          result.errorType === 'MARKETPLACE_COOLDOWN')
      ) {
        jobsRepo.updateNextRun(job.id, getNextMorning())
        continue
      }

      // Save snapshot — same logic as the manual capture IPC handler
      let c = competitor
      if (result.success) {
        if (c.title !== result.snapshot.title || c.image_url !== result.snapshot.image_url) {
          competitorsRepo.update(c.id, {
            title: result.snapshot.title ?? c.title,
            image_url: result.snapshot.image_url ?? c.image_url
          })
        }
        competitorsRepo.resetFailures(c.id)
        if (c.status === 'error') {
          competitorsRepo.updateStatus(c.id, 'active')
        }

        const snapshot = snapshotsRepo.create({
          ...result.snapshot,
          competitor_id: c.id
        })
        runAlertRules(c.id, snapshot)
      } else if (result.product) {
        // URL parsed but page load/parse failed — save failed snapshot
        competitorsRepo.incrementFailures(c.id)
        c = competitorsRepo.findById(c.id)!
        if (c.consecutive_failures >= 3) {
          competitorsRepo.updateStatus(c.id, 'paused')
        }

        snapshotsRepo.create({
          competitor_id: c.id,
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
        })
      }

      // Schedule next run. The default cadence is two workday checks:
      // one immediately when due, one roughly 6h later, then tomorrow morning.
      scheduleNextRun(job.id, job.interval_minutes, jobsRepo, db, competitor.id)

      // Random delay between jobs
      const delay =
        Math.floor(Math.random() * (MAX_DELAY_BETWEEN_JOBS_MS - MIN_DELAY_BETWEEN_JOBS_MS + 1)) +
        MIN_DELAY_BETWEEN_JOBS_MS
      await sleep(delay)
    }

    const storesRepo = new SellerStoresRepository(db)
    for (const store of storesRepo.findActive()) storesRepo.ensureJob(store.id)
    for (const store of storesRepo.dueStores()) {
      if (_state !== 'running') break
      await scanSellerStore(db, store)
    }
  } catch {
    // Scheduler errors should not crash the app — log and continue
  } finally {
    _processing = false
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
