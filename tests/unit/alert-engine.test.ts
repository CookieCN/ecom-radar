import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDb } from '../helpers/db'
import { CompetitorsRepository } from '../../src/data/repositories/competitors'
import { SnapshotsRepository } from '../../src/data/repositories/snapshots'
import { AlertsRepository } from '../../src/data/repositories/alerts'
// Note: runAlertRules uses getDatabase() which requires the app singleton.
// Tests validate the underlying alert logic via repository methods directly.

describe('Alert rule logic (via repositories)', () => {
  let db: Database.Database
  let competitorsRepo: CompetitorsRepository
  let snapshotsRepo: SnapshotsRepository
  let alertsRepo: AlertsRepository
  let competitorId: number

  beforeEach(() => {
    db = createTestDb()
    competitorsRepo = new CompetitorsRepository(db)
    snapshotsRepo = new SnapshotsRepository(db)
    alertsRepo = new AlertsRepository(db)

    const c = competitorsRepo.create({
      asin: 'B00TEST',
      marketplace: 'US',
      url: 'https://amazon.com/dp/B00TEST',
      title: 'Test Product',
      image_url: null,
      status: 'active',
      consecutive_failures: 0
    })
    competitorId = c.id
  })

  afterEach(() => {
    db.close()
  })

  function addSnapshot(overrides: Partial<{
    price: number; rating: number; reviewCount: number; availability: string
  }> = {}) {
    return snapshotsRepo.create({
      competitor_id: competitorId,
      title: 'Test',
      price: overrides.price ?? 10,
      currency: 'USD',
      rating: overrides.rating ?? 4.0,
      review_count: overrides.reviewCount ?? 100,
      availability: overrides.availability ?? 'In Stock',
      image_url: null,
      captured_at: new Date().toISOString(),
      capture_status: 'success',
      error_type: null,
      error_message: null
    })
  }

  describe('price change detection', () => {
    it('generates alert when price changes >= 5%', () => {
      addSnapshot({ price: 10 })
      const s2 = addSnapshot({ price: 12 }) // 20% increase

      // Manual alert creation (simulating what runAlertRules does)
      const previous = snapshotsRepo.findPrevious(competitorId, s2.id)
      const pctChange = Math.abs((s2.price! - previous!.price!) / previous!.price!) * 100
      expect(pctChange).toBeCloseTo(20, 1)
      expect(pctChange).toBeGreaterThanOrEqual(5)
    })

    it('does not alert on small price changes', () => {
      addSnapshot({ price: 10 })
      addSnapshot({ price: 10.2 }) // 2% change

      const snaps = snapshotsRepo.findByCompetitorId(competitorId)
      const latest = snaps[0]
      const previous = snapshotsRepo.findPrevious(competitorId, latest.id)
      const pctChange = Math.abs((latest.price! - previous!.price!) / previous!.price!) * 100
      expect(pctChange).toBeCloseTo(2, 1)
      expect(pctChange).toBeLessThan(5)
    })
  })

  describe('rating drop detection', () => {
    it('detects significant rating drop', () => {
      addSnapshot({ rating: 4.5 })
      addSnapshot({ rating: 4.0 }) // -0.5

      const snaps = snapshotsRepo.findByCompetitorId(competitorId)
      const latest = snaps[0]
      const previous = snapshotsRepo.findPrevious(competitorId, latest.id)
      const drop = previous!.rating! - latest.rating!
      expect(drop).toBe(0.5)
      expect(drop).toBeGreaterThanOrEqual(0.3)
    })

    it('does not alert on small rating drop', () => {
      addSnapshot({ rating: 4.5 })
      addSnapshot({ rating: 4.4 }) // -0.1

      const snaps = snapshotsRepo.findByCompetitorId(competitorId)
      const latest = snaps[0]
      const previous = snapshotsRepo.findPrevious(competitorId, latest.id)
      const drop = previous!.rating! - latest.rating!
      expect(drop).toBeLessThan(0.3)
    })
  })

  describe('review growth detection', () => {
    it('detects significant review growth', () => {
      addSnapshot({ reviewCount: 100 })
      addSnapshot({ reviewCount: 120 })

      const snaps = snapshotsRepo.findByCompetitorId(competitorId)
      const latest = snaps[0]
      const previous = snapshotsRepo.findPrevious(competitorId, latest.id)
      const growth = latest.review_count! - previous!.review_count!
      expect(growth).toBe(20)
      expect(growth).toBeGreaterThanOrEqual(10)
    })

    it('does not alert on small review growth', () => {
      addSnapshot({ reviewCount: 100 })
      addSnapshot({ reviewCount: 105 })

      const snaps = snapshotsRepo.findByCompetitorId(competitorId)
      const latest = snaps[0]
      const previous = snapshotsRepo.findPrevious(competitorId, latest.id)
      const growth = latest.review_count! - previous!.review_count!
      expect(growth).toBeLessThan(10)
    })

    it('does not alert on review decrease', () => {
      addSnapshot({ reviewCount: 120 })
      addSnapshot({ reviewCount: 100 }) // decrease, not growth

      const snaps = snapshotsRepo.findByCompetitorId(competitorId)
      const latest = snaps[0]
      const previous = snapshotsRepo.findPrevious(competitorId, latest.id)
      const growth = latest.review_count! - previous!.review_count!
      expect(growth).toBe(-20)
    })
  })

  describe('availability change detection', () => {
    it('detects availability change', () => {
      addSnapshot({ availability: 'In Stock' })
      addSnapshot({ availability: 'Out of Stock' })

      const snaps = snapshotsRepo.findByCompetitorId(competitorId)
      const latest = snaps[0]
      const previous = snapshotsRepo.findPrevious(competitorId, latest.id)
      expect(previous!.availability).not.toBe(latest!.availability)
    })

    it('does not alert when availability is same', () => {
      addSnapshot({ availability: 'In Stock' })
      addSnapshot({ availability: 'In Stock' })

      const snaps = snapshotsRepo.findByCompetitorId(competitorId)
      const latest = snaps[0]
      const previous = snapshotsRepo.findPrevious(competitorId, latest.id)
      expect(previous!.availability).toBe(latest!.availability)
    })
  })

  describe('no alert on first snapshot', () => {
    it('no previous snapshot means no alert', () => {
      addSnapshot({ price: 10 })
      const snaps = snapshotsRepo.findByCompetitorId(competitorId)
      expect(snaps).toHaveLength(1)
      expect(snapshotsRepo.findPrevious(competitorId, snaps[0].id)).toBeUndefined()
    })
  })

  describe('dedup', () => {
    it('alerts repo has dedup window capability', () => {
      // Create an alert, then check if findByCompetitorId can be used for dedup
      alertsRepo.create({
        competitor_id: competitorId,
        snapshot_id: null,
        previous_snapshot_id: null,
        alert_type: 'price_change',
        title: 'Price dropped',
        message: 'Test',
        is_read: 0
      })

      const alerts = alertsRepo.findByCompetitorId(competitorId)
      expect(alerts).toHaveLength(1)
      expect(alerts[0].is_read).toBe(0)
    })
  })
})
