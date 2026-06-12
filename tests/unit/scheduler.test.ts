import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDb } from '../helpers/db'
import { CompetitorsRepository } from '../../src/data/repositories/competitors'
import { MonitorJobsRepository } from '../../src/data/repositories/monitor_jobs'

// Test the job management logic that the scheduler uses
// (actual capture loop is tested via capture-service.test.ts)

describe('Scheduler — job management', () => {
  let db: Database.Database
  let competitorsRepo: CompetitorsRepository
  let jobsRepo: MonitorJobsRepository

  beforeEach(() => {
    db = createTestDb()
    competitorsRepo = new CompetitorsRepository(db)
    jobsRepo = new MonitorJobsRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('ensure jobs exist for active competitors', () => {
    it('creates job for active competitor with no job', () => {
      competitorsRepo.create({
        asin: 'B001', marketplace: 'US',
        url: 'https://amazon.com/dp/B001', title: null, image_url: null,
        status: 'active', consecutive_failures: 0
      })

      // Simulate ensureJobsExist
      const active = competitorsRepo.findAll('active')
      for (const c of active) {
        const existing = jobsRepo.findByCompetitorId(c.id)
        if (!existing) {
          jobsRepo.create({ competitor_id: c.id, interval_minutes: 360, next_run_at: null, enabled: 1 })
        }
      }

      const job = jobsRepo.findByCompetitorId(1)
      expect(job).toBeDefined()
      expect(job!.interval_minutes).toBe(360)
      expect(job!.enabled).toBe(1)
    })

    it('skips competitors that already have a job', () => {
      const c = competitorsRepo.create({
        asin: 'B001', marketplace: 'US',
        url: 'https://amazon.com/dp/B001', title: null, image_url: null,
        status: 'active', consecutive_failures: 0
      })
      jobsRepo.create({ competitor_id: c.id, interval_minutes: 720, next_run_at: null, enabled: 1 })

      // Re-run ensure
      const active = competitorsRepo.findAll('active')
      let created = 0
      for (const comp of active) {
        const existing = jobsRepo.findByCompetitorId(comp.id)
        if (!existing) {
          jobsRepo.create({ competitor_id: comp.id, interval_minutes: 360, next_run_at: null, enabled: 1 })
          created++
        }
      }

      expect(created).toBe(0)
      const job = jobsRepo.findByCompetitorId(c.id)
      expect(job!.interval_minutes).toBe(720) // unchanged
    })

    it('does not create jobs for paused competitors', () => {
      competitorsRepo.create({
        asin: 'B002', marketplace: 'US',
        url: 'https://amazon.com/dp/B002', title: null, image_url: null,
        status: 'paused', consecutive_failures: 0
      })

      const active = competitorsRepo.findAll('active')
      expect(active).toHaveLength(0)
    })
  })

  describe('findAllDue', () => {
    it('returns jobs with null next_run_at', () => {
      const c = competitorsRepo.create({
        asin: 'B001', marketplace: 'US',
        url: 'https://amazon.com/dp/B001', title: null, image_url: null,
        status: 'active', consecutive_failures: 0
      })
      jobsRepo.create({ competitor_id: c.id, interval_minutes: 360, next_run_at: null, enabled: 1 })

      const due = jobsRepo.findAllDue()
      expect(due).toHaveLength(1)
    })

    it('returns jobs with past next_run_at', () => {
      const c = competitorsRepo.create({
        asin: 'B001', marketplace: 'US',
        url: 'https://amazon.com/dp/B001', title: null, image_url: null,
        status: 'active', consecutive_failures: 0
      })
      jobsRepo.create({
        competitor_id: c.id,
        interval_minutes: 360,
        next_run_at: '2020-01-01T00:00:00Z',
        enabled: 1
      })

      const due = jobsRepo.findAllDue()
      expect(due).toHaveLength(1)
    })

    it('does not return disabled jobs', () => {
      const c = competitorsRepo.create({
        asin: 'B001', marketplace: 'US',
        url: 'https://amazon.com/dp/B001', title: null, image_url: null,
        status: 'active', consecutive_failures: 0
      })
      jobsRepo.create({ competitor_id: c.id, interval_minutes: 360, next_run_at: null, enabled: 0 })

      const due = jobsRepo.findAllDue()
      expect(due).toHaveLength(0)
    })
  })

  describe('updateNextRun', () => {
    it('sets next_run_at', () => {
      const c = competitorsRepo.create({
        asin: 'B001', marketplace: 'US',
        url: 'https://amazon.com/dp/B001', title: null, image_url: null,
        status: 'active', consecutive_failures: 0
      })
      const job = jobsRepo.create({
        competitor_id: c.id, interval_minutes: 360, next_run_at: null, enabled: 1
      })

      const nextRun = '2026-07-01T00:00:00Z'
      jobsRepo.updateNextRun(job.id, nextRun)

      const updated = jobsRepo.findById(job.id)
      expect(updated!.next_run_at).toBe(nextRun)
    })
  })
})
