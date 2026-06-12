// ============================================================
// Local scheduler — sequential queue, random delays, auto-pause
// ============================================================

import { getDatabase } from '../data'
import { CompetitorsRepository } from '../data/repositories/competitors'
import { SnapshotsRepository } from '../data/repositories/snapshots'
import { MonitorJobsRepository } from '../data/repositories/monitor_jobs'
import { captureProduct } from '../capture'
import { runAlertRules } from '../alerts'

const POLL_INTERVAL_MS = 60_000 // check for due jobs every 60 seconds
const DEFAULT_JOB_INTERVAL_MINUTES = 360 // 6 hours
const MIN_DELAY_BETWEEN_JOBS_MS = 10_000

/** Convert Date to SQLite-compatible datetime string: YYYY-MM-DD HH:mm:ss */
function toSqliteDatetime(date: Date): string {
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')
}
const MAX_DELAY_BETWEEN_JOBS_MS = 60_000

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

      // Run capture
      const result = await captureProduct(competitor.url)

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

      // Schedule next run with random jitter
      const intervalMs = job.interval_minutes * 60 * 1000
      const jitter = Math.floor(Math.random() * 15 * 60 * 1000) // ±0-15 min jitter
      const nextRun = toSqliteDatetime(new Date(Date.now() + intervalMs + jitter))
      jobsRepo.updateNextRun(job.id, nextRun)

      // Random delay between jobs
      const delay =
        Math.floor(Math.random() * (MAX_DELAY_BETWEEN_JOBS_MS - MIN_DELAY_BETWEEN_JOBS_MS + 1)) +
        MIN_DELAY_BETWEEN_JOBS_MS
      await sleep(delay)
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
