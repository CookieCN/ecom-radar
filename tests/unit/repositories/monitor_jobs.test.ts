import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDb } from '../../helpers/db'
import { CompetitorsRepository } from '../../../src/data/repositories/competitors'
import { MonitorJobsRepository } from '../../../src/data/repositories/monitor_jobs'
import { NewMonitorJob } from '../../../src/data/types'

describe('MonitorJobsRepository', () => {
  let db: Database.Database
  let repo: MonitorJobsRepository
  let competitorId: number

  beforeEach(() => {
    db = createTestDb()
    repo = new MonitorJobsRepository(db)
    const cRepo = new CompetitorsRepository(db)
    const c = cRepo.create({
      asin: 'B00TEST',
      marketplace: 'US',
      url: 'https://www.amazon.com/dp/B00TEST',
      title: null,
      image_url: null,
      status: 'active',
      consecutive_failures: 0
    })
    competitorId = c.id
  })

  afterEach(() => {
    db.close()
  })

  const sampleJob: NewMonitorJob = {
    competitor_id: 0, // set per test
    interval_minutes: 360,
    next_run_at: null,
    enabled: 1
  }

  function job(data: Partial<NewMonitorJob> = {}): NewMonitorJob {
    return { ...sampleJob, competitor_id: competitorId, ...data }
  }

  describe('create', () => {
    it('should create a monitor job', () => {
      const result = repo.create(job())
      expect(result.id).toBeGreaterThan(0)
      expect(result.interval_minutes).toBe(360)
      expect(result.enabled).toBe(1)
    })

    it('should not allow duplicate competitor_id', () => {
      repo.create(job())
      expect(() => repo.create(job())).toThrow()
    })
  })

  describe('findByCompetitorId', () => {
    it('should find job by competitor', () => {
      const created = repo.create(job())
      const found = repo.findByCompetitorId(competitorId)
      expect(found!.id).toBe(created.id)
    })

    it('should return undefined if not found', () => {
      expect(repo.findByCompetitorId(999)).toBeUndefined()
    })
  })

  describe('findAllEnabled', () => {
    it('should return only enabled jobs', () => {
      repo.create(job({ enabled: 1 }))

      // Create second competitor + disabled job
      const cRepo = new CompetitorsRepository(db)
      const c2 = cRepo.create({
        asin: 'B00TEST2',
        marketplace: 'US',
        url: 'https://www.amazon.com/dp/B00TEST2',
        title: null,
        image_url: null,
        status: 'active',
        consecutive_failures: 0
      })
      repo.create({ ...job(), competitor_id: c2.id, enabled: 0 })

      const enabled = repo.findAllEnabled()
      expect(enabled).toHaveLength(1)
      expect(enabled[0].competitor_id).toBe(competitorId)
    })
  })

  describe('updateNextRun', () => {
    it('should update next_run_at', () => {
      const created = repo.create(job())
      repo.updateNextRun(created.id, '2026-06-13T00:00:00Z')
      const updated = repo.findById(created.id)
      expect(updated!.next_run_at).toBe('2026-06-13T00:00:00Z')
    })
  })

  describe('toggleEnabled', () => {
    it('should enable and disable job', () => {
      const created = repo.create(job())
      repo.toggleEnabled(created.id, false)
      expect(repo.findById(created.id)!.enabled).toBe(0)
      repo.toggleEnabled(created.id, true)
      expect(repo.findById(created.id)!.enabled).toBe(1)
    })
  })

  describe('updateInterval', () => {
    it('should update interval', () => {
      const created = repo.create(job())
      repo.updateInterval(created.id, 720)
      expect(repo.findById(created.id)!.interval_minutes).toBe(720)
    })
  })

  describe('deleteByCompetitorId', () => {
    it('should delete job for competitor', () => {
      repo.create(job())
      repo.deleteByCompetitorId(competitorId)
      expect(repo.findByCompetitorId(competitorId)).toBeUndefined()
    })
  })
})
