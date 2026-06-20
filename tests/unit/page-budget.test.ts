import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDb } from '../helpers/db'
import { PageBudgetService } from '../../src/monitoring/page-budget'

describe('PageBudgetService', () => {
  let db: Database.Database
  let service: PageBudgetService
  beforeEach(() => {
    db = createTestDb()
    service = new PageBudgetService(db)
  })
  afterEach(() => db.close())

  it('defaults to 80 and rejects values above 100', () => {
    expect(service.getLimit()).toBe(80)
    expect(() => service.setLimit(101)).toThrow(/between 1 and 100/)
  })

  it('defers the 81st navigation with the default budget', () => {
    for (let index = 0; index < 80; index++)
      expect(service.reserve('US', 'product', 'test').allowed).toBe(true)
    expect(service.reserve('US', 'product', 'test')).toEqual({ allowed: false, reason: 'budget' })
  })

  it('allows 100 but defers the 101st navigation', () => {
    service.setLimit(100)
    for (let index = 0; index < 100; index++) service.reserve('US', 'product', 'test')
    expect(service.reserve('US', 'product', 'test')).toEqual({ allowed: false, reason: 'budget' })
  })

  it('starts a marketplace cooldown for risk errors', () => {
    service.registerRisk('DE', 'CAPTCHA_DETECTED')
    expect(service.reserve('DE', 'product', 'test')).toEqual({ allowed: false, reason: 'cooldown' })
    expect(service.reserve('US', 'product', 'test').allowed).toBe(true)
  })
})
