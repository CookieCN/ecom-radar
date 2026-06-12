import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDb } from '../../helpers/db'
import { CompetitorsRepository } from '../../../src/data/repositories/competitors'
import { AlertsRepository } from '../../../src/data/repositories/alerts'
import { NewAlert } from '../../../src/data/types'

describe('AlertsRepository', () => {
  let db: Database.Database
  let repo: AlertsRepository
  let competitorId: number

  beforeEach(() => {
    db = createTestDb()
    repo = new AlertsRepository(db)
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

  const sampleAlert: NewAlert = {
    competitor_id: 0, // set per test
    snapshot_id: null,
    previous_snapshot_id: null,
    alert_type: 'price_change',
    title: 'Price dropped',
    message: 'Price dropped from $29.99 to $24.99',
    is_read: 0
  }

  function a(data: Partial<NewAlert> = {}): NewAlert {
    return { ...sampleAlert, competitor_id: competitorId, ...data }
  }

  describe('create', () => {
    it('should create an alert', () => {
      const result = repo.create(a())
      expect(result.id).toBeGreaterThan(0)
      expect(result.alert_type).toBe('price_change')
      expect(result.is_read).toBe(0)
    })
  })

  describe('findByCompetitorId', () => {
    it('should return alerts ordered by created_at DESC', () => {
      repo.create(a({ message: 'first' }))
      repo.create(a({ message: 'second' }))
      const alerts = repo.findByCompetitorId(competitorId)
      expect(alerts).toHaveLength(2)
      expect(alerts[0].message).toBe('second') // newest first
    })
  })

  describe('findAll', () => {
    it('should return all alerts across competitors', () => {
      repo.create(a())

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
      repo.create({ ...a(), competitor_id: c2.id, message: 'c2 alert' })

      const all = repo.findAll()
      expect(all).toHaveLength(2)
    })
  })

  describe('findUnread', () => {
    it('should return only unread alerts', () => {
      repo.create(a({ is_read: 0, message: 'unread' }))
      repo.create(a({ is_read: 1, message: 'read' }))
      const unread = repo.findUnread()
      expect(unread).toHaveLength(1)
      expect(unread[0].message).toBe('unread')
    })
  })

  describe('countUnread', () => {
    it('should count unread alerts', () => {
      expect(repo.countUnread()).toBe(0)
      repo.create(a({ is_read: 0 }))
      repo.create(a({ is_read: 0 }))
      repo.create(a({ is_read: 1 }))
      expect(repo.countUnread()).toBe(2)
    })
  })

  describe('markAsRead', () => {
    it('should mark alert as read', () => {
      const created = repo.create(a())
      repo.markAsRead(created.id)
      const found = repo.findById(created.id)
      expect(found!.is_read).toBe(1)
    })
  })

  describe('markAllAsRead', () => {
    it('should mark all unread for a competitor', () => {
      repo.create(a({ is_read: 0 }))
      repo.create(a({ is_read: 0 }))
      repo.markAllAsRead(competitorId)
      const unread = repo.findUnread()
      expect(unread).toHaveLength(0)
    })

    it('should mark all unread globally', () => {
      const cRepo = new CompetitorsRepository(db)
      const c2 = cRepo.create({
        asin: 'B00T2',
        marketplace: 'US',
        url: 'https://www.amazon.com/dp/B00T2',
        title: null,
        image_url: null,
        status: 'active',
        consecutive_failures: 0
      })
      repo.create(a({ is_read: 0 }))
      repo.create({ ...a(), competitor_id: c2.id, is_read: 0 })
      repo.markAllAsRead()
      expect(repo.countUnread()).toBe(0)
    })
  })

  describe('alert_type check constraint', () => {
    it('should reject invalid alert_type', () => {
      expect(() => {
        repo.create({ ...a(), alert_type: 'invalid' as 'price_change' })
      }).toThrow()
    })
  })
})
