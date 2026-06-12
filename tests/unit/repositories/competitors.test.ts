import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDb } from '../../helpers/db'
import { CompetitorsRepository } from '../../../src/data/repositories/competitors'
import { NewCompetitor } from '../../../src/data/types'

describe('CompetitorsRepository', () => {
  let db: Database.Database
  let repo: CompetitorsRepository

  beforeEach(() => {
    db = createTestDb()
    repo = new CompetitorsRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  const sampleCompetitor: NewCompetitor = {
    asin: 'B0EXAMPLE1',
    marketplace: 'US',
    url: 'https://www.amazon.com/dp/B0EXAMPLE1',
    title: 'Example Product',
    image_url: 'https://example.com/img.jpg',
    status: 'active',
    consecutive_failures: 0
  }

  describe('create', () => {
    it('should create a competitor and return it with id and timestamps', () => {
      const result = repo.create(sampleCompetitor)
      expect(result.id).toBeGreaterThan(0)
      expect(result.asin).toBe('B0EXAMPLE1')
      expect(result.marketplace).toBe('US')
      expect(result.status).toBe('active')
      expect(result.created_at).toBeTruthy()
      expect(result.updated_at).toBeTruthy()
    })
  })

  describe('findById', () => {
    it('should return the competitor', () => {
      const created = repo.create(sampleCompetitor)
      const found = repo.findById(created.id)
      expect(found).toBeDefined()
      expect(found!.asin).toBe('B0EXAMPLE1')
    })

    it('should return undefined for non-existent id', () => {
      expect(repo.findById(999)).toBeUndefined()
    })
  })

  describe('findByAsin', () => {
    it('should find by ASIN and marketplace', () => {
      repo.create(sampleCompetitor)
      const found = repo.findByAsin('B0EXAMPLE1', 'US')
      expect(found).toBeDefined()
      expect(found!.url).toBe('https://www.amazon.com/dp/B0EXAMPLE1')
    })

    it('should return undefined for wrong marketplace', () => {
      repo.create(sampleCompetitor)
      expect(repo.findByAsin('B0EXAMPLE1', 'JP')).toBeUndefined()
    })
  })

  describe('findAll', () => {
    it('should return all competitors ordered by updated_at DESC', () => {
      repo.create({ ...sampleCompetitor, asin: 'B001' })
      repo.create({ ...sampleCompetitor, asin: 'B002' })
      const all = repo.findAll()
      expect(all).toHaveLength(2)
    })

    it('should filter by status', () => {
      repo.create({ ...sampleCompetitor, asin: 'B001', status: 'active' })
      repo.create({ ...sampleCompetitor, asin: 'B002', status: 'paused' })
      const active = repo.findAll('active')
      expect(active).toHaveLength(1)
      expect(active[0].asin).toBe('B001')
    })
  })

  describe('update', () => {
    it('should update fields and return updated competitor', () => {
      const created = repo.create(sampleCompetitor)
      const updated = repo.update(created.id, { title: 'Updated Title', status: 'paused' })
      expect(updated!.title).toBe('Updated Title')
      expect(updated!.status).toBe('paused')
      expect(updated!.asin).toBe('B0EXAMPLE1') // unchanged
    })
  })

  describe('delete', () => {
    it('should delete competitor and cascade', () => {
      const created = repo.create(sampleCompetitor)
      repo.delete(created.id)
      expect(repo.findById(created.id)).toBeUndefined()
    })
  })

  describe('incrementFailures / resetFailures', () => {
    it('should increment and reset consecutive failures', () => {
      const created = repo.create(sampleCompetitor)
      repo.incrementFailures(created.id)
      repo.incrementFailures(created.id)
      let found = repo.findById(created.id)
      expect(found!.consecutive_failures).toBe(2)

      repo.resetFailures(created.id)
      found = repo.findById(created.id)
      expect(found!.consecutive_failures).toBe(0)
    })
  })

  describe('updateStatus', () => {
    it('should update status', () => {
      const created = repo.create(sampleCompetitor)
      repo.updateStatus(created.id, 'error')
      const found = repo.findById(created.id)
      expect(found!.status).toBe('error')
    })
  })

  describe('count', () => {
    it('should return total count', () => {
      expect(repo.count()).toBe(0)
      repo.create(sampleCompetitor)
      expect(repo.count()).toBe(1)
    })
  })
})
