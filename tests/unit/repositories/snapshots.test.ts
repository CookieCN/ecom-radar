import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDb } from '../../helpers/db'
import { CompetitorsRepository } from '../../../src/data/repositories/competitors'
import { SnapshotsRepository } from '../../../src/data/repositories/snapshots'
import { NewSnapshot } from '../../../src/data/types'

describe('SnapshotsRepository', () => {
  let db: Database.Database
  let repo: SnapshotsRepository
  let competitorsRepo: CompetitorsRepository
  let competitorId: number

  beforeEach(() => {
    db = createTestDb()
    repo = new SnapshotsRepository(db)
    competitorsRepo = new CompetitorsRepository(db)
    const c = competitorsRepo.create({
      asin: 'B00TEST',
      marketplace: 'US',
      url: 'https://www.amazon.com/dp/B00TEST',
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

  const successSnapshot: NewSnapshot = {
    competitor_id: 0, // set in each test
    title: 'Test Product',
    price: 19.99,
    currency: 'USD',
    rating: 4.5,
    review_count: 100,
    availability: 'In Stock',
    image_url: 'https://example.com/img.jpg',
    captured_at: new Date().toISOString(),
    capture_status: 'success',
    error_type: null,
    error_message: null
  }

  const failedSnapshot: NewSnapshot = {
    competitor_id: 0,
    title: null,
    price: null,
    currency: null,
    rating: null,
    review_count: null,
    availability: null,
    image_url: null,
    captured_at: new Date().toISOString(),
    capture_status: 'failed',
    error_type: 'CAPTCHA_DETECTED',
    error_message: 'Captcha page detected'
  }

  function s(data: Partial<NewSnapshot> = {}): NewSnapshot {
    return { ...successSnapshot, competitor_id: competitorId, ...data }
  }

  describe('create', () => {
    it('should create a successful snapshot', () => {
      const result = repo.create(s())
      expect(result.id).toBeGreaterThan(0)
      expect(result.title).toBe('Test Product')
      expect(result.price).toBe(19.99)
      expect(result.capture_status).toBe('success')
    })

    it('should create a failed snapshot with error info', () => {
      const result = repo.create({ ...failedSnapshot, competitor_id: competitorId })
      expect(result.capture_status).toBe('failed')
      expect(result.error_type).toBe('CAPTCHA_DETECTED')
      expect(result.error_message).toBe('Captcha page detected')
    })
  })

  describe('findByCompetitorId', () => {
    it('should return snapshots ordered by captured_at DESC', () => {
      repo.create(s({ captured_at: '2026-01-01T00:00:00Z', review_count: 50 }))
      repo.create(s({ captured_at: '2026-02-01T00:00:00Z', review_count: 100 }))
      const snaps = repo.findByCompetitorId(competitorId)
      expect(snaps).toHaveLength(2)
      expect(snaps[0].review_count).toBe(100) // newest first
      expect(snaps[1].review_count).toBe(50)
    })

    it('should respect limit parameter', () => {
      repo.create(s({ review_count: 1 }))
      repo.create(s({ review_count: 2 }))
      repo.create(s({ review_count: 3 }))
      const snaps = repo.findByCompetitorId(competitorId, 2)
      expect(snaps).toHaveLength(2)
    })
  })

  describe('findLatest', () => {
    it('should return the most recent snapshot', () => {
      repo.create(s({ captured_at: '2026-01-01T00:00:00Z' }))
      repo.create(s({ captured_at: '2026-03-01T00:00:00Z', price: 29.99 }))
      const latest = repo.findLatest(competitorId)
      expect(latest).toBeDefined()
      expect(latest!.price).toBe(29.99)
    })

    it('should return undefined when no snapshots exist', () => {
      expect(repo.findLatest(competitorId)).toBeUndefined()
    })
  })

  describe('findPrevious', () => {
    it('should return the previous successful snapshot', () => {
      const s1 = repo.create(s({ captured_at: '2026-01-01T00:00:00Z', price: 15.0 }))
      const s2 = repo.create(s({ captured_at: '2026-02-01T00:00:00Z', price: 20.0 }))
      const prev = repo.findPrevious(competitorId, s2.id)
      expect(prev).toBeDefined()
      expect(prev!.id).toBe(s1.id)
      expect(prev!.price).toBe(15.0)
    })

    it('should skip failed snapshots', () => {
      repo.create(s({ captured_at: '2026-01-01T00:00:00Z', price: 15.0 }))
      repo.create({
        ...failedSnapshot,
        competitor_id: competitorId,
        captured_at: '2026-02-01T00:00:00Z'
      })
      const s3 = repo.create(s({ captured_at: '2026-03-01T00:00:00Z', price: 25.0 }))
      const prev = repo.findPrevious(competitorId, s3.id)
      expect(prev).toBeDefined()
      expect(prev!.price).toBe(15.0) // skips the failed one
    })
  })

  describe('findAllSuccessful', () => {
    it('should return only successful snapshots ordered ASC', () => {
      repo.create(s({ captured_at: '2026-01-01T00:00:00Z' }))
      repo.create({
        ...failedSnapshot,
        competitor_id: competitorId,
        captured_at: '2026-02-01T00:00:00Z'
      })
      repo.create(s({ captured_at: '2026-03-01T00:00:00Z' }))
      const snaps = repo.findAllSuccessful(competitorId)
      expect(snaps).toHaveLength(2)
      expect(snaps[0].capture_status).toBe('success')
      expect(snaps[1].capture_status).toBe('success')
    })
  })

  describe('countByCompetitorId', () => {
    it('should return snapshot count', () => {
      expect(repo.countByCompetitorId(competitorId)).toBe(0)
      repo.create(s())
      repo.create(s())
      expect(repo.countByCompetitorId(competitorId)).toBe(2)
    })
  })

  describe('deleteByCompetitorId', () => {
    it('should delete all snapshots for competitor', () => {
      repo.create(s())
      repo.create(s())
      repo.deleteByCompetitorId(competitorId)
      expect(repo.countByCompetitorId(competitorId)).toBe(0)
    })
  })
})
