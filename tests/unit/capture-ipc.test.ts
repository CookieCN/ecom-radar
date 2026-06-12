import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDb } from '../helpers/db'
import { CompetitorsRepository } from '../../src/data/repositories/competitors'
import { SnapshotsRepository } from '../../src/data/repositories/snapshots'

// We test the DB save logic that the IPC handler performs.
// The IPC handler in main/index.ts does:
//   1. call captureProduct(input)
//   2. if no product → return error, no DB write
//   3. find-or-create competitor
//   4. save snapshot (success or failed)
//   5. update competitor status/failures
// This test exercises steps 2-5 with real DB.

describe('Capture IPC handler — DB save logic', () => {
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

  // Simulate what the IPC handler does for a successful capture
  function simulateCaptureSuccess(
    asin: string,
    marketplace: string,
    url: string,
    title: string,
    price: number,
    rating: number,
    reviewCount: number
  ) {
    let competitor = competitorsRepo.findByAsin(asin, marketplace)
    if (!competitor) {
      competitor = competitorsRepo.create({
        asin,
        marketplace,
        url,
        title,
        image_url: null,
        status: 'active',
        consecutive_failures: 0
      })
    } else {
      competitorsRepo.update(competitor.id, { title })
      competitorsRepo.resetFailures(competitor.id)
      if (competitor.status === 'error') {
        competitorsRepo.updateStatus(competitor.id, 'active')
      }
      competitor = competitorsRepo.findById(competitor.id)!
    }

    const snapshot = snapshotsRepo.create({
      competitor_id: competitor.id,
      title,
      price,
      currency: 'USD',
      rating,
      review_count: reviewCount,
      availability: 'In Stock',
      image_url: null,
      captured_at: new Date().toISOString(),
      capture_status: 'success',
      error_type: null,
      error_message: null
    })

    return { competitor, snapshot }
  }

  // Simulate what the IPC handler does for a failed capture
  function simulateCaptureFailure(
    asin: string,
    marketplace: string,
    url: string,
    errorType: string,
    errorMessage: string
  ) {
    let competitor = competitorsRepo.findByAsin(asin, marketplace)
    if (!competitor) {
      competitor = competitorsRepo.create({
        asin,
        marketplace,
        url,
        title: null,
        image_url: null,
        status: 'error',
        consecutive_failures: 1
      })
    } else {
      competitorsRepo.incrementFailures(competitor.id)
      const updated = competitorsRepo.findById(competitor.id)
      if (updated && updated.consecutive_failures >= 3) {
        competitorsRepo.updateStatus(competitor.id, 'paused')
      }
      competitor = competitorsRepo.findById(competitor.id)!
    }

    const snapshot = snapshotsRepo.create({
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
      error_type: errorType as 'CAPTCHA_DETECTED',
      error_message: errorMessage
    })

    return { competitor, snapshot }
  }

  describe('success capture', () => {
    it('creates competitor on first capture', () => {
      const { competitor, snapshot } = simulateCaptureSuccess(
        'B00NEW1',
        'US',
        'https://www.amazon.com/dp/B00NEW1',
        'New Product',
        29.99,
        4.5,
        500
      )

      expect(competitor.id).toBeGreaterThan(0)
      expect(competitor.asin).toBe('B00NEW1')
      expect(competitor.status).toBe('active')
      expect(snapshot.capture_status).toBe('success')
      expect(snapshot.price).toBe(29.99)
    })

    it('reuses existing competitor on subsequent capture', () => {
      simulateCaptureSuccess('B00NEW2', 'US', 'https://amazon.com/dp/B00NEW2', 'First', 10, 4.0, 10)
      const { competitor } = simulateCaptureSuccess(
        'B00NEW2',
        'US',
        'https://amazon.com/dp/B00NEW2',
        'Updated',
        12,
        4.1,
        12
      )

      expect(competitor.id).toBe(1) // same competitor
      expect(competitor.title).toBe('Updated')
      expect(snapshotsRepo.countByCompetitorId(competitor.id)).toBe(2)
    })

    it('resets consecutive_failures on success', () => {
      simulateCaptureFailure('B00NEW3', 'US', 'url', 'CAPTCHA_DETECTED', 'Captcha')
      simulateCaptureFailure('B00NEW3', 'US', 'url', 'CAPTCHA_DETECTED', 'Captcha')
      // 2 failures, then success
      simulateCaptureSuccess('B00NEW3', 'US', 'url', 'Product', 10, 4.0, 20)
      const competitor = competitorsRepo.findByAsin('B00NEW3', 'US')
      expect(competitor!.consecutive_failures).toBe(0)
      expect(competitor!.status).toBe('active')
    })
  })

  describe('failed capture', () => {
    it('creates competitor with status=error and failed snapshot', () => {
      const { competitor, snapshot } = simulateCaptureFailure(
        'B00FAIL1',
        'US',
        'https://www.amazon.com/dp/B00FAIL1',
        'CAPTCHA_DETECTED',
        'Captcha page detected'
      )

      expect(competitor.status).toBe('error')
      expect(competitor.consecutive_failures).toBe(1)
      expect(snapshot.capture_status).toBe('failed')
      expect(snapshot.error_type).toBe('CAPTCHA_DETECTED')
      expect(snapshot.title).toBeNull()
      expect(snapshot.price).toBeNull()
    })

    it('increments consecutive_failures on repeated failure', () => {
      simulateCaptureFailure('B00FAIL2', 'US', 'url', 'NETWORK_TIMEOUT', 'Timeout')
      const { competitor } = simulateCaptureFailure(
        'B00FAIL2',
        'US',
        'url',
        'NETWORK_TIMEOUT',
        'Timeout'
      )

      expect(competitor.consecutive_failures).toBe(2)
    })

    it('auto-pauses after 3 consecutive failures', () => {
      simulateCaptureFailure('B00FAIL3', 'US', 'url', 'NETWORK_TIMEOUT', 'T1')
      simulateCaptureFailure('B00FAIL3', 'US', 'url', 'NETWORK_TIMEOUT', 'T2')
      const { competitor } = simulateCaptureFailure(
        'B00FAIL3',
        'US',
        'url',
        'NETWORK_TIMEOUT',
        'T3'
      )

      expect(competitor.consecutive_failures).toBe(3)
      expect(competitor.status).toBe('paused')
    })

    it('saves a failed snapshot for every failure attempt', () => {
      simulateCaptureFailure('B00FAIL4', 'US', 'url', 'CAPTCHA_DETECTED', 'C1')
      simulateCaptureFailure('B00FAIL4', 'US', 'url', 'PAGE_LOAD_FAILED', 'P1')
      simulateCaptureFailure('B00FAIL4', 'US', 'url', 'NETWORK_TIMEOUT', 'N1')

      expect(snapshotsRepo.countByCompetitorId(1)).toBe(3)
      const snaps = snapshotsRepo.findByCompetitorId(1)
      expect(snaps.every((s) => s.capture_status === 'failed')).toBe(true)
    })
  })
})
