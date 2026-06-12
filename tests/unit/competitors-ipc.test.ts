import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDb } from '../helpers/db'
import { CompetitorsRepository } from '../../src/data/repositories/competitors'
import { SnapshotsRepository } from '../../src/data/repositories/snapshots'

// Test the repository logic behind the new IPC handlers

describe('Competitors IPC handler — DB logic', () => {
  let db: Database.Database
  let competitorsRepo: CompetitorsRepository
  let snapshotsRepo: SnapshotsRepository

  beforeEach(() => {
    db = createTestDb()
    competitorsRepo = new CompetitorsRepository(db)
    snapshotsRepo = new SnapshotsRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  function createCompetitor(
    asin: string,
    marketplace = 'US',
    status: 'active' | 'paused' | 'error' = 'active'
  ) {
    return competitorsRepo.create({
      asin,
      marketplace,
      url: `https://www.amazon.${marketplace === 'US' ? 'com' : marketplace.toLowerCase()}/dp/${asin}`,
      title: `Product ${asin}`,
      image_url: null,
      status,
      consecutive_failures: 0
    })
  }

  function addSnapshot(competitorId: number, price: number, rating: number, reviews: number) {
    return snapshotsRepo.create({
      competitor_id: competitorId,
      title: 'Test',
      price,
      currency: 'USD',
      rating,
      review_count: reviews,
      availability: 'In Stock',
      image_url: null,
      captured_at: new Date().toISOString(),
      capture_status: 'success',
      error_type: null,
      error_message: null
    })
  }

  function addFailedSnapshot(competitorId: number, errorType: string, errorMessage: string) {
    return snapshotsRepo.create({
      competitor_id: competitorId,
      title: null,
      price: null,
      currency: null,
      rating: null,
      review_count: null,
      availability: null,
      image_url: null,
      captured_at: new Date().toISOString(),
      capture_status: 'failed',
      error_type: errorType as 'CAPTCHA_DETECTED',
      error_message: errorMessage
    })
  }

  describe('competitors:list', () => {
    it('returns empty array when no competitors', () => {
      const all = competitorsRepo.findAll()
      expect(all).toHaveLength(0)
    })

    it('returns all competitors with correct fields', () => {
      createCompetitor('B001')
      createCompetitor('B002', 'UK')

      const all = competitorsRepo.findAll()
      expect(all).toHaveLength(2)
      expect(all[0].asin).toBe('B001')
      expect(all[1].marketplace).toBe('UK')
    })

    it('filters by status', () => {
      createCompetitor('B001', 'US', 'active')
      createCompetitor('B002', 'US', 'paused')

      const active = competitorsRepo.findAll('active')
      expect(active).toHaveLength(1)
      expect(active[0].asin).toBe('B001')

      const paused = competitorsRepo.findAll('paused')
      expect(paused).toHaveLength(1)
    })

    it('provides latest snapshot data', () => {
      const c = createCompetitor('B001')
      addSnapshot(c.id, 10, 4.0, 100)
      addSnapshot(c.id, 12, 4.2, 120)

      const latest = snapshotsRepo.findLatest(c.id)
      expect(latest!.price).toBe(12)
      expect(latest!.rating).toBe(4.2)
      expect(snapshotsRepo.countByCompetitorId(c.id)).toBe(2)
    })
  })

  describe('competitors:get', () => {
    it('returns null for missing id', () => {
      expect(competitorsRepo.findById(999)).toBeUndefined()
    })

    it('returns competitor with snapshots in order', () => {
      const c = createCompetitor('B001')
      addSnapshot(c.id, 10, 4.0, 100)
      addSnapshot(c.id, 15, 4.5, 200)
      addFailedSnapshot(c.id, 'CAPTCHA_DETECTED', 'Captcha')

      const detail = competitorsRepo.findById(c.id)
      expect(detail).toBeDefined()
      expect(detail!.asin).toBe('B001')

      const snaps = snapshotsRepo.findByCompetitorId(c.id)
      expect(snaps).toHaveLength(3)
      // newest first
      expect(snaps[0].capture_status).toBe('failed')
      expect(snaps[1].capture_status).toBe('success')
    })
  })

  describe('competitors:delete', () => {
    it('deletes competitor and cascades snapshots', () => {
      const c = createCompetitor('B001')
      addSnapshot(c.id, 10, 4.0, 100)
      expect(snapshotsRepo.countByCompetitorId(c.id)).toBe(1)

      competitorsRepo.delete(c.id)
      expect(competitorsRepo.findById(c.id)).toBeUndefined()
      expect(snapshotsRepo.countByCompetitorId(c.id)).toBe(0)
    })
  })

  describe('competitors:toggle-status', () => {
    it('toggles active to paused', () => {
      const c = createCompetitor('B001', 'US', 'active')
      competitorsRepo.updateStatus(c.id, 'paused')
      const updated = competitorsRepo.findById(c.id)
      expect(updated!.status).toBe('paused')
    })

    it('toggles paused to active', () => {
      const c = createCompetitor('B001', 'US', 'paused')
      competitorsRepo.updateStatus(c.id, 'active')
      const updated = competitorsRepo.findById(c.id)
      expect(updated!.status).toBe('active')
    })
  })
})
